import pandas as pd
import re
from typing import Tuple, Optional

class PriceExtractor:
    def extract(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        if pd.isna(text):
            return None, None
        text = str(text).lower()
        
        # Price per m²
        m = re.search(r'(\d+[\s,]*\d*)\s*(?:€|euro)\s*(?:/|per)\s*m(?:2|²)', text)
        if m:
            try:
                return float(m.group(1).replace(' ', '').replace(',', '.')), 'per_sqm'
            except:
                pass
        
        # Total price (take last)
        matches = re.findall(r'(?:€|euro)\s*(\d+[\s,]*\d*)', text)
        if matches:
            try:
                price = float(matches[-1].replace(' ', '').replace(',', '.'))
                return (price, 'total') if price > 100 else (None, None)
            except:
                pass
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