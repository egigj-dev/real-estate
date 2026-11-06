"""
app/data/areas.py  —  OSM sub-area fetching, caching, point-in-polygon

Design
------
* Overpass query fetches admin_level 8/9 relations around Tirana
* Each relation's outer-way geometry points are collected (no stitching)
* Convex hull computed from those points → clean polygon
* Ray-casting PIP assigns each listing an area_name
* Cache in data/areas.json (7-day TTL)

If Overpass is unreachable, returns [] and area_name falls back to
the KMeans neighborhood label.
"""

import json, math, time, urllib.request, urllib.parse
from pathlib import Path
from typing import Optional
import pandas as pd

_BASE  = Path(__file__).resolve().parent.parent.parent  # backend/
_CACHE = _BASE / "data" / "areas.json"
_CACHE_TTL = 7 * 24 * 3600

_OVERPASS = "https://overpass-api.de/api/interpreter"
_QUERY = """[out:json][timeout:30];
(
  relation["boundary"="administrative"]["admin_level"~"8|9"]
          (around:8000,41.3275,19.8187);
);
out geom;"""


# ─── Overpass ─────────────────────────────────────────────────────────────────

def _fetch_overpass() -> list:
    try:
        data = urllib.parse.urlencode({"data": _QUERY}).encode()
        req  = urllib.request.Request(
            _OVERPASS, data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded",
                     "User-Agent": "TiranaRealEstate/1.0"})
        with urllib.request.urlopen(req, timeout=40) as r:
            elements = json.loads(r.read())["elements"]
        print(f"[areas] Overpass → {len(elements)} elements")
        return elements
    except Exception as e:
        print(f"[areas] Overpass unavailable: {e}")
        return []


# ─── Polygon construction ──────────────────────────────────────────────────────

def _collect_outer_points(members: list) -> list:
    """Collect all (lat, lon) points from outer-role way members."""
    pts = []
    for m in members:
        if m.get("type") != "way":
            continue
        if m.get("role", "") not in ("outer", ""):
            continue
        for g in m.get("geometry", []):
            if "lat" in g and "lon" in g:
                pts.append((float(g["lat"]), float(g["lon"])))
    return pts


def _convex_hull(pts: list) -> list:
    """Graham scan convex hull (no external deps). Returns (lat,lon) list."""
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts

    def cross(O, A, B):
        return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _parse_areas(elements: list) -> list:
    areas = []
    skipped = 0
    for el in elements:
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        name = (tags.get("name:sq") or tags.get("name") or "").strip()
        if not name:
            continue

        pts  = _collect_outer_points(el.get("members", []))
        poly = _convex_hull(pts)

        if len(poly) < 3:
            skipped += 1
            continue

        lats = [p[0] for p in poly]
        lons = [p[1] for p in poly]
        areas.append({
            "name":        name,
            "osm_id":      el.get("id"),
            "admin_level": tags.get("admin_level", ""),
            "polygon":     poly,
            "bbox": {
                "min_lat": min(lats), "max_lat": max(lats),
                "min_lon": min(lons), "max_lon": max(lons),
            },
        })

    areas.sort(key=lambda a: a["name"])
    print(f"[areas] Built {len(areas)} areas ({skipped} skipped — no geometry)")
    for a in areas:
        b = a["bbox"]
        print(f"  L{a['admin_level']} '{a['name']}' "
              f"pts={len(a['polygon'])} "
              f"lat=[{b['min_lat']:.4f},{b['max_lat']:.4f}] "
              f"lon=[{b['min_lon']:.4f},{b['max_lon']:.4f}]")
    return areas


# ─── Cache ─────────────────────────────────────────────────────────────────────

def _load_cache() -> Optional[list]:
    if not _CACHE.exists():
        return None
    if time.time() - _CACHE.stat().st_mtime > _CACHE_TTL:
        print("[areas] Cache expired — refetching")
        return None
    with open(_CACHE) as f:
        data = json.load(f)
    print(f"[areas] {len(data)} areas from cache")
    return data


def _save_cache(areas: list):
    _CACHE.parent.mkdir(parents=True, exist_ok=True)
    with open(_CACHE, "w") as f:
        json.dump(areas, f, ensure_ascii=False)
    print(f"[areas] Cache saved → {_CACHE}")


def get_areas(force_refresh: bool = False) -> list:
    if not force_refresh:
        cached = _load_cache()
        if cached is not None:
            return cached
    elements = _fetch_overpass()
    if not elements:
        return []
    areas = _parse_areas(elements)
    if areas:
        _save_cache(areas)
    return areas


# ─── Point-in-polygon ─────────────────────────────────────────────────────────

def _pip(lat: float, lon: float, poly: list) -> bool:
    """Ray-casting PIP. poly = [(lat,lon), …]"""
    n      = len(poly)
    inside = False
    j      = n - 1
    for i in range(n):
        lat_i, lon_i = poly[i][0], poly[i][1]
        lat_j, lon_j = poly[j][0], poly[j][1]
        if (lat_i > lat) != (lat_j > lat):
            x = lon_j + (lon_i - lon_j) * (lat - lat_j) / ((lat_i - lat_j) or 1e-12)
            if lon < x:
                inside = not inside
        j = i
    return inside


def _bbox_ok(lat: float, lon: float, bbox: dict) -> bool:
    return (bbox["min_lat"] <= lat <= bbox["max_lat"] and
            bbox["min_lon"] <= lon <= bbox["max_lon"])


# ─── Assign area_name ─────────────────────────────────────────────────────────

def assign_area_names(df: pd.DataFrame, areas: list) -> pd.DataFrame:
    """
    Adds area_name column to df.
    Fallback → KMeans neighborhood label for unmatched rows.
    """
    if not areas or "latitude" not in df.columns:
        df["area_name"] = df.get("neighborhood",
                                  pd.Series("E panjohur", index=df.index))
        return df

    print(f"[areas] Assigning {len(areas)} OSM areas to {len(df):,} listings…")

    def find(lat, lon):
        if pd.isna(lat) or pd.isna(lon):
            return None
        cands   = [a for a in areas if _bbox_ok(lat, lon, a["bbox"])]
        matches = [a for a in cands  if _pip(lat, lon, a["polygon"])]
        if not matches:
            return None
        # Prefer finer admin level
        matches.sort(key=lambda a: -(int(a.get("admin_level") or 0)))
        return matches[0]["name"]

    lats = df["latitude"].tolist()
    lons = df["longitude"].tolist()
    df["area_name"] = [find(lat, lon) for lat, lon in zip(lats, lons)]

    matched = df["area_name"].notna().sum()
    print(f"[areas] Matched {matched:,}/{len(df):,} ({100*matched//len(df)}%)")

    fb = df["neighborhood"] if "neighborhood" in df.columns \
         else pd.Series("E panjohur", index=df.index)
    df["area_name"] = df["area_name"].fillna(fb)

    print("[areas] Distribution:\n" +
          "\n".join(f"  {k}: {v}" for k, v in
                    df["area_name"].value_counts().head(10).items()))
    return df