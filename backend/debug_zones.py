"""
Run this from your backend/ directory:
    python3 /tmp/debug_zones.py

Prints a full diagnosis of why zone filtering fails.
"""
import json, sys, math
from pathlib import Path
from collections import Counter

BASE = Path.cwd()
print(f"Working dir: {BASE}\n")

# ── 1. Check areas.json ────────────────────────────────────────────────────────
areas_path = BASE / "data" / "areas.json"
print("=" * 60)
print("1. areas.json")
print("=" * 60)
if not areas_path.exists():
    print("  MISSING — assign_areas.py was never run or failed")
    areas = []
else:
    with open(areas_path) as f:
        areas = json.load(f)
    print(f"  {len(areas)} areas found")
    for a in areas:
        b = a["bbox"]
        poly = a["polygon"]
        print(f"  L{a['admin_level']} '{a['name']}' "
              f"pts={len(poly)} "
              f"lat=[{b['min_lat']:.5f},{b['max_lat']:.5f}] "
              f"lon=[{b['min_lon']:.5f},{b['max_lon']:.5f}]")
    print()
    # Sanity: do bboxes overlap correctly for Tirana?
    # Tirana centre is ~41.3275, 19.8187
    centre_lat, centre_lon = 41.3275, 19.8187
    covering = [a["name"] for a in areas
                if a["bbox"]["min_lat"] <= centre_lat <= a["bbox"]["max_lat"]
                and a["bbox"]["min_lon"] <= centre_lon <= a["bbox"]["max_lon"]]
    print(f"  Areas whose bbox covers Tirana centre: {covering}")

# ── 2. Check final_data.json ───────────────────────────────────────────────────
print("=" * 60)
print("2. final_data.json")
print("=" * 60)
data_path = BASE / "data" / "final_data.json"
if not data_path.exists():
    print("  MISSING"); sys.exit(1)

with open(data_path) as f:
    raw = json.load(f)

if isinstance(raw, dict):
    # column-oriented
    keys = list(raw.keys())
    n = len(list(raw.values())[0]) if raw else 0
else:
    keys = list(raw[0].keys()) if raw else []
    n = len(raw)

print(f"  {n} records, {len(keys)} columns")
print(f"  Has 'area_name': {'area_name' in keys}")
print(f"  Has 'neighborhood': {'neighborhood' in keys}")
print(f"  Has 'lat'/'latitude': {'lat' in keys or 'latitude' in keys}")
print(f"  Has 'lng'/'longitude': {'lng' in keys or 'longitude' in keys}")

# Get sample records
if isinstance(raw, dict):
    import pandas as pd
    records = pd.DataFrame(raw).to_dict(orient="records")
else:
    records = raw

lat_key = "lat" if "lat" in records[0] else "latitude" if "latitude" in records[0] else None
lon_key = "lng" if "lng" in records[0] else "longitude" if "longitude" in records[0] else None
print(f"  lat_key={lat_key}, lon_key={lon_key}")

if "area_name" in records[0] or "area_name" in keys:
    area_names = [r.get("area_name") for r in records]
    dist = Counter(a for a in area_names)
    null_count = sum(1 for a in area_names if a is None or (isinstance(a, float) and math.isnan(a)))
    print(f"\n  area_name distribution ({null_count} null):")
    for name, cnt in dist.most_common(15):
        print(f"    {str(name):40s} {cnt}")
else:
    print("\n  area_name column DOES NOT EXIST in final_data.json")
    print("  → Run: python3 assign_areas.py")

if "neighborhood" in records[0] or "neighborhood" in keys:
    nb_dist = Counter(r.get("neighborhood") for r in records)
    print(f"\n  neighborhood (KMeans) distribution:")
    for name, cnt in nb_dist.most_common(10):
        print(f"    {str(name):40s} {cnt}")

# ── 3. PIP test against areas ──────────────────────────────────────────────────
if areas and lat_key:
    print()
    print("=" * 60)
    print("3. PIP test (10 random listings)")
    print("=" * 60)

    def bbox_ok(lat, lon, bbox):
        return (bbox["min_lat"] <= lat <= bbox["max_lat"] and
                bbox["min_lon"] <= lon <= bbox["max_lon"])

    def pip(lat, lon, poly):
        n = len(poly); inside = False; j = n - 1
        for i in range(n):
            # poly[i] might be list or tuple after JSON round-trip
            lat_i, lon_i = poly[i][0], poly[i][1]
            lat_j, lon_j = poly[j][0], poly[j][1]
            if (lat_i > lat) != (lat_j > lat):
                x = lon_j + (lon_i - lon_j) * (lat - lat_j) / ((lat_i - lat_j) or 1e-12)
                if lon < x:
                    inside = not inside
            j = i
        return inside

    def find_area(lat, lon):
        if lat is None or lon is None: return None
        try:
            lat, lon = float(lat), float(lon)
            if math.isnan(lat) or math.isnan(lon): return None
        except: return None
        cands = [a for a in areas if bbox_ok(lat, lon, a["bbox"])]
        hits  = [a for a in cands if pip(lat, lon, a["polygon"])]
        if not hits: return f"NO MATCH (bbox cands: {[a['name'][:15] for a in cands]})"
        hits.sort(key=lambda a: -(int(a.get("admin_level") or 0)))
        return hits[0]["name"]

    import random
    random.seed(42)
    sample = random.sample(records, min(10, len(records)))
    for r in sample:
        lat = r.get(lat_key); lon = r.get(lon_key)
        computed = find_area(lat, lon)
        stored   = r.get("area_name", "NOT IN FILE")
        match = "✓" if computed == stored else "✗ MISMATCH"
        print(f"  ({lat},{lon})")
        print(f"    stored={stored}")
        print(f"    computed={computed}  {match}")

# ── 4. Simulate the exact API filter ──────────────────────────────────────────
print()
print("=" * 60)
print("4. Filter simulation")
print("=" * 60)
if "area_name" in (records[0] if records else {}):
    area_names_unique = sorted(set(r.get("area_name") for r in records
                                   if r.get("area_name")))
    print(f"  Unique area_names in data ({len(area_names_unique)}):")
    for n in area_names_unique:
        cnt = sum(1 for r in records if r.get("area_name") == n)
        print(f"    '{n}': {cnt} listings")

    if area_names_unique:
        test_area = area_names_unique[0]
        filtered = [r for r in records
                    if isinstance(r.get("area_name"), str)
                    and r["area_name"].lower() == test_area.lower()]
        print(f"\n  Filtering by '{test_area}': {len(filtered)} results")

        # Check lat/lon range of filtered results
        if filtered and lat_key:
            lats = [float(r[lat_key]) for r in filtered if r.get(lat_key)]
            lons = [float(r[lon_key]) for r in filtered if r.get(lon_key)]
            if lats:
                print(f"  Lat range: {min(lats):.4f} – {max(lats):.4f}")
                print(f"  Lon range: {min(lons):.4f} – {max(lons):.4f}")

print("\nDone.")