"""
Chat router
-----------
POST /chat/parse  — parse natural language into structured property features.

Zone handling after hierarchical 3×2 retrain
---------------------------------------------
With 6 zones (Periferia A/B, Zona e Mesme A/B, Qendra A, Qendra & Blloku)
users can't meaningfully distinguish sub-zones in free text.
We therefore return a BROAD zone hint ("Qendra & Blloku", "Zona e Mesme",
"Periferia") and let suggest.py's partial-match resolver pick the best
sub-zone from the actual data.  This keeps the UX simple while still
narrowing the search to the right part of the city.
"""

import os
import re
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["Chat"])


class ParseRequest(BaseModel):
    text: str


class ParsedFeatures(BaseModel):
    sqm:               Optional[float] = None
    floor:             Optional[float] = None
    beds:              Optional[int]   = None
    baths:             Optional[float] = None
    has_elevator:      Optional[bool]  = None
    has_parking_space: Optional[bool]  = None
    neighborhood:      Optional[str]   = None
    raw_text:          str
    method:            str   # "claude" | "keywords"


# keyword → broad zone prefix  (suggest.py does partial/contains match)
_ZONE_MAP = {
    # central
    "bllok":      "Qendra & Blloku",
    "blloku":     "Qendra & Blloku",
    "qendra":     "Qendra & Blloku",
    "qender":     "Qendra & Blloku",
    "center":     "Qendra & Blloku",
    "wilson":     "Qendra & Blloku",
    "myslym":     "Qendra & Blloku",
    "skënderbej": "Qendra & Blloku",
    "skenderbej": "Qendra & Blloku",
    # mid-ring  (Komuna e Parisit is now split across Zona e Mesme A/B)
    "komuna":     "Zona e Mesme",
    "paris":      "Zona e Mesme",
    "don bosco":  "Zona e Mesme",
    "don_bosco":  "Zona e Mesme",
    "21 dhjetori": "Zona e Mesme",
    "zogu i zi":  "Zona e Mesme",
    "5 maji":     "Zona e Mesme",
    "zona e mesme": "Zona e Mesme",
    # periphery
    "periferi":   "Periferia",
    "periferik":  "Periferia",
    "kashar":     "Periferia",
    "vaqarr":     "Periferia",
    "kamez":      "Periferia",
    "kamëz":      "Periferia",
    "farka":      "Periferia",
    "paskuqan":   "Periferia",
    "astir":      "Periferia",
    "sauk":       "Periferia",
}


def _keyword_parse(text: str) -> dict:
    t = text.lower()

    # sqm
    sqm = None
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:m²|m2|metra katrore|metër|meter|sqm)', t)
    if m:
        sqm = float(m.group(1))

    # floor
    floor = None
    m = re.search(r'kati?\s*(?:i\s*)?(\d+)', t)
    if not m:
        m = re.search(r'(\d+)\s*kat', t)
    if m:
        floor = float(m.group(1))

    # beds: "2+1" / "2 dhoma" / word numbers
    beds = None
    words = {'nje': 1, 'një': 1, 'dy': 2, 'tre': 3, 'tri': 3,
             'kater': 4, 'katër': 4, 'pese': 5, 'pesë': 5}
    m = re.search(r'(\d)\s*\+\s*1', t)
    if m:
        beds = int(m.group(1)) + 1
    else:
        m = re.search(r'(\d+)\s+(?:dhoma|bedroom|room)', t)
        if m:
            beds = int(m.group(1))
        else:
            for word, val in words.items():
                if re.search(rf'\b{word}\b.*dhom', t):
                    beds = val
                    break

    # baths
    baths = None
    m = re.search(r'(\d+)\s*(?:banjo|bathroom|wc)', t)
    if m:
        baths = float(m.group(1))

    # amenities
    has_elevator      = bool(re.search(r'ashensor|elevator|lift', t))
    has_parking_space = bool(re.search(r'parking|garazh|garage', t))

    # zone — try longest keyword first to avoid "paris" matching inside "parisit"
    neighborhood = None
    for kw in sorted(_ZONE_MAP, key=len, reverse=True):
        if kw in t:
            neighborhood = _ZONE_MAP[kw]
            break

    result = {"raw_text": text, "method": "keywords"}
    if sqm:               result["sqm"]               = sqm
    if floor:             result["floor"]             = floor
    if beds:              result["beds"]              = beds
    if baths:             result["baths"]             = baths
    if has_elevator:      result["has_elevator"]      = True
    if has_parking_space: result["has_parking_space"] = True
    if neighborhood:      result["neighborhood"]      = neighborhood
    return result


async def _claude_parse(text: str) -> dict | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import httpx
        prompt = f"""Extract property search features from this Albanian/English text.
Return ONLY valid JSON with these optional keys (omit if not mentioned):
sqm (float), floor (int), beds (int), baths (float),
has_elevator (bool), has_parking_space (bool),
neighborhood (one of: "Qendra & Blloku", "Zona e Mesme", "Periferia", or null)

Use "Qendra & Blloku" for central areas (Bllok, Wilson, Skënderbej).
Use "Zona e Mesme" for mid-ring areas (Komuna e Parisit, Don Bosco, 21 Dhjetori).
Use "Periferia" for outer areas (Kashar, Kamëz, Farka, Astir, Sauk).

Text: "{text}"
JSON:"""

        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        if r.status_code != 200:
            return None
        content = r.json()["content"][0]["text"].strip()
        content = re.sub(r"```json|```", "", content).strip()
        parsed  = json.loads(content)
        parsed["raw_text"] = text
        parsed["method"]   = "claude"
        return parsed
    except Exception:
        return None


@router.post("/chat/parse", response_model=ParsedFeatures)
async def parse_description(body: ParseRequest):
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    result = await _claude_parse(body.text)
    if result is None:
        result = _keyword_parse(body.text)
    return ParsedFeatures(**result)