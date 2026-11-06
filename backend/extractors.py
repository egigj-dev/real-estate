import pandas as pd
import re
from typing import Tuple, Optional

# A number as written in Albanian listings: "1.200", "1,200" and "1 200" mean
# 1200; "1,5" and "1.5" are decimals.
NUMBER = r'(\d{1,3}(?:[.,\s]\d{3})+(?![\d])|\d+(?:[.,]\d+)?)'


def parse_number(raw: str) -> Optional[float]:
    s = raw.strip()
    if re.fullmatch(r'\d{1,3}(?:[.,\s]\d{3})+', s):
        return float(re.sub(r'[.,\s]', '', s))
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


class PriceExtractor:
    def extract(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        if pd.isna(text):
            return None, None
        text = str(text).lower()
        
        # Price per m²
        m = re.search(NUMBER + r'\s*(?:€|euro)\s*(?:/|per)\s*m(?:2|²)', text)
        if m:
            value = parse_number(m.group(1))
            if value is not None and 300 <= value <= 6000:
                return value, 'per_sqm'

        # Total price (take last)
        matches = re.findall(r'(?:€|euro)\s*' + NUMBER, text)
        if matches:
            price = parse_number(matches[-1])
            return (price, 'total') if price and price > 100 else (None, None)
        return None, None


class AreaExtractor:
    def extract_best(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        if pd.isna(text):
            return None, None
        text = str(text).lower()
        
        # Bruto area
        for p in [r'(\d+[\s,]*\.?\d*)\s*m2?\s*bruto', r'bruto\s*[:\s]*(\d+[\s,]*\.?\d*)\s*m2?']:
            m = re.findall(p, text)
            if m:
                vals = [self._parse(x) for x in m if self._parse(x)]
                if vals:
                    return max(vals), 'bruto'
        
        # Neto area
        m = re.findall(r'(\d+[\s,]*\.?\d*)\s*m2?\s+neto', text)
        if m:
            vals = [self._parse(x) for x in m if self._parse(x)]
            if vals:
                return max(vals), 'neto'
        
        return None, None
    
    def _parse(self, text: str) -> Optional[float]:
        try:
            v = float(text.replace(' ', '').replace(',', '.'))
            return v if 15 < v < 300 else None
        except:
            return None