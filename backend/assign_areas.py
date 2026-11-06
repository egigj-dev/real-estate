"""
assign_areas.py — run ONCE from backend/ after training

  python3 assign_areas.py

What it does:
  1. Fetches Tirana sub-area polygons from Overpass API
  2. Point-in-polygon assigns every listing in final_data.json an area_name
  3. Saves the result back into final_data.json

After this, the API reads area_name directly from the file — no Overpass
calls or PIP computation happen at runtime.

Re-run whenever:
  - You retrain the model (new final_data.json)
  - OSM boundaries change meaningfully
"""

import json, sys, math, time, urllib.request, urllib.parse
from pathlib import Path

BASE        = Path(__file__).resolve().parent
FINAL_DATA  = BASE / "data" / "final_data.json"
AREAS_CACHE = BASE / "data" / "areas.json"

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """[out:json][timeout:30];
(
  relation["boundary"="administrative"]["admin_level"~"8|9"]
          (around:8000,41.3275,19.8187);
);
out geom;"""

# ── helpers ────────────────────────────────────────────────────────────────────

def fetch_overpass():
    print("Fetching from Overpass API…", flush=True)
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req  = urllib.request.Request(
        OVERPASS, data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "User-Agent": "TiranaRealEstate/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        elements = json.loads(r.read())["elements"]
    print(f"  Got {len(elements)} elements from Overpass")
    return elements


def collect_outer_pts(members):
    pts = []
    for m in members:
        if m.get("type") != "way": continue
        if m.get("role", "") not in ("outer", ""): continue
        for g in m.get("geometry", []):
            if "lat" in g and "lon" in g:
                pts.append((float(g["lat"]), float(g["lon"])))
    return pts


def convex_hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3: return pts
    def cross(O, A, B):
        return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def parse_areas(elements):
    areas = []
    for el in elements:
        if el.get("type") != "relation": continue
        tags = el.get("tags", {})
        name = (tags.get("name:sq") or tags.get("name") or "").strip()
        if not name: continue
        pts  = collect_outer_pts(el.get("members", []))
        poly = convex_hull(pts)
        if len(poly) < 3: continue
        lats = [p[0] for p in poly]
        lons = [p[1] for p in poly]
        areas.append({
            "name":        name,
            "osm_id":      el.get("id"),
            "admin_level": tags.get("admin_level", ""),
            "polygon":     poly,
            "bbox": {"min_lat": min(lats), "max_lat": max(lats),
                     "min_lon": min(lons), "max_lon": max(lons)},
        })
    areas.sort(key=lambda a: a["name"])
    print(f"\n  Parsed {len(areas)} areas:")
    for a in areas:
        b = a["bbox"]
        print(f"    L{a['admin_level']} '{a['name']}' "
              f"pts={len(a['polygon'])} "
              f"lat=[{b['min_lat']:.4f},{b['max_lat']:.4f}] "
              f"lon=[{b['min_lon']:.4f},{b['max_lon']:.4f}]")
    return areas


def bbox_ok(lat, lon, bbox):
    return (bbox["min_lat"] <= lat <= bbox["max_lat"] and
            bbox["min_lon"] <= lon <= bbox["max_lon"])


def pip(lat, lon, poly):
    n = len(poly); inside = False; j = n - 1
    for i in range(n):
        lat_i, lon_i = poly[i][0], poly[i][1]
        lat_j, lon_j = poly[j][0], poly[j][1]
        if (lat_i > lat) != (lat_j > lat):
            x = lon_j + (lon_i - lon_j) * (lat - lat_j) / ((lat_i - lat_j) or 1e-12)
            if lon < x: inside = not inside
        j = i
    return inside


def find_area(lat, lon, areas):
    if lat is None or lon is None or math.isnan(lat) or math.isnan(lon):
        return None
    cands   = [a for a in areas if bbox_ok(lat, lon, a["bbox"])]
    matches = [a for a in cands  if pip(lat, lon, a["polygon"])]
    if not matches: return None
    matches.sort(key=lambda a: -(int(a.get("admin_level") or 0)))
    return matches[0]["name"]


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    if not FINAL_DATA.exists():
        print(f"ERROR: {FINAL_DATA} not found. Run train_model.py first.")
        sys.exit(1)

    # Load areas (use cache if fresh, else fetch)
    areas = None
    if AREAS_CACHE.exists():
        age = time.time() - AREAS_CACHE.stat().st_mtime
        if age < 7 * 86400:
            with open(AREAS_CACHE) as f:
                areas = json.load(f)
            print(f"Using cached areas ({len(areas)} areas, {age/3600:.1f}h old)")

    if not areas:
        elements = fetch_overpass()
        areas = parse_areas(elements)
        if not areas:
            print("ERROR: No areas fetched. Check your internet connection.")
            sys.exit(1)
        AREAS_CACHE.parent.mkdir(parents=True, exist_ok=True)
        with open(AREAS_CACHE, "w") as f:
            json.dump(areas, f, ensure_ascii=False)
        print(f"Saved areas cache → {AREAS_CACHE}")

    # Load final_data.json
    print(f"\nLoading {FINAL_DATA}…")
    with open(FINAL_DATA) as f:
        records = json.load(f)

    # Handle both list-of-records and column-oriented formats
    if isinstance(records, dict):
        # column-oriented: {"col": {idx: val}}
        import pandas as pd
        df = pd.DataFrame(records)
        records = df.to_dict(orient="records")

    print(f"  {len(records)} listings")

    lat_key = "lat" if "lat" in records[0] else "latitude"  if "latitude"  in records[0] else None
    lon_key = "lng" if "lng" in records[0] else "longitude" if "longitude" in records[0] else None

    if not lat_key or not lon_key:
        print(f"ERROR: Cannot find lat/lon columns. Keys: {list(records[0].keys())[:10]}")
        sys.exit(1)

    print(f"  Using lat={lat_key}, lon={lon_key}")

    # Assign area_name
    print(f"\nAssigning areas to {len(records)} listings…")
    t0 = time.time()
    matched = 0
    for rec in records:
        try:
            lat = float(rec[lat_key]) if rec.get(lat_key) is not None else None
            lon = float(rec[lon_key]) if rec.get(lon_key) is not None else None
        except (TypeError, ValueError):
            lat, lon = None, None

        area = find_area(lat, lon, areas)
        if area:
            rec["area_name"] = area
            matched += 1
        else:
            rec["area_name"] = None   # will show as "E panjohur" in frontend

    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.1f}s")
    print(f"  Matched: {matched}/{len(records)} ({100*matched//len(records)}%)")

    # Distribution
    from collections import Counter
    dist = Counter(r.get("area_name") or "None" for r in records)
    print("\n  Distribution:")
    for name, count in dist.most_common(20):
        print(f"    {name}: {count}")

    unmatched = [r for r in records if not r.get("area_name")]
    if unmatched:
        print(f"\n  Unmatched sample ({min(5,len(unmatched))} of {len(unmatched)}):")
        for r in unmatched[:5]:
            lat = r.get(lat_key); lon = r.get(lon_key)
            print(f"    ({lat}, {lon})")

    # Save
    print(f"\nSaving → {FINAL_DATA}")
    with open(FINAL_DATA, "w") as f:
        json.dump(records, f, ensure_ascii=False)
    print("Done ✓")
    print("\nRestart uvicorn now — area_name will be read directly from file.")


if __name__ == "__main__":
    main()