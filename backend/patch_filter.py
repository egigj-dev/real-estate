"""
patch_filter.py  —  run from your backend/ directory:

    python3 patch_filter.py

This script:
1. Patches app/services/listing_service.py  (the actual filter logic)
2. Patches app/routers/listings.py          (ensures area_name param exists)
3. Verifies final_data.json has area_name column
4. Tells you what to do next
"""
import sys, re
from pathlib import Path

BASE = Path(__file__).resolve().parent
print(f"Working in: {BASE}\n")

# ── 1. Patch listing_service.py ───────────────────────────────────────────────
svc = BASE / "app" / "services" / "listing_service.py"
if not svc.exists():
    print(f"ERROR: {svc} not found"); sys.exit(1)

text = svc.read_text()

# Check current state
if "area_name" not in text:
    print(f"PATCHING {svc} — area_name missing entirely")

    # Find the neighborhood filter line and add area_name after it
    old = '    if neighborhood  is not None:\n        mask &= df["neighborhood"].str.lower() == neighborhood.lower()'
    new = ('    if neighborhood  is not None:\n'
           '        mask &= df["neighborhood"].str.lower() == neighborhood.lower()\n'
           '    if area_name is not None:\n'
           '        if "area_name" in df.columns:\n'
           '            mask &= df["area_name"].str.lower() == area_name.lower()\n'
           '        else:\n'
           '            print("[filter] WARNING: area_name column missing — run assign_areas.py then restart")')
    if old in text:
        text = text.replace(old, new)
        print("  ✓ Added area_name filter after neighborhood filter")
    else:
        print("  ✗ Could not find insertion point — showing current filter section:")
        for i, line in enumerate(text.splitlines()):
            if "neighborhood" in line.lower() and "mask" in line:
                print(f"    {i+1}: {line}")
        sys.exit(1)

    # Add area_name param to function signature
    old_sig = 'def filter_listings('
    # find the block and add area_name if missing
    if 'area_name' not in text:
        text = text.replace(
            '    neighborhood:  Optional[str]   = None,',
            '    neighborhood:  Optional[str]   = None,\n    area_name:     Optional[str]   = None,'
        )
        print("  ✓ Added area_name param to filter_listings()")

    svc.write_text(text)
    print(f"  Saved {svc}")
else:
    print(f"✓ {svc.name} already has area_name filter")

# Quick verify: is the guard `if "area_name" in df.columns:` present?
text = svc.read_text()
if '"area_name" in df.columns' in text:
    print("  ✓ Column guard present")
else:
    print("  ✗ Column guard MISSING — filter will crash if column absent")

# ── 2. Patch listings.py router ───────────────────────────────────────────────
router = BASE / "app" / "routers" / "listings.py"
if not router.exists():
    router = BASE / "app" / "routers" / "listing.py"

if router.exists():
    rtext = router.read_text()
    if "area_name" not in rtext:
        print(f"\nPATCHING {router.name} — area_name param missing")
        rtext = rtext.replace(
            'neighborhood:      Optional[str]   = Query(default=None)',
            'neighborhood:      Optional[str]   = Query(default=None),\n    area_name:         Optional[str]   = Query(default=None)',
        )
        # Also add to filter_listings() call
        rtext = rtext.replace(
            'neighborhood=neighborhood,',
            'neighborhood=neighborhood,\n        area_name=area_name,',
        )
        router.write_text(rtext)
        print(f"  ✓ Patched {router.name}")
    else:
        print(f"✓ {router.name} already has area_name param")
else:
    print("WARNING: listings router not found — check path")

# ── 3. Check final_data.json ──────────────────────────────────────────────────
data_file = BASE / "data" / "final_data.json"
print(f"\n=== Checking {data_file.name} ===")
if not data_file.exists():
    print("ERROR: final_data.json not found"); sys.exit(1)

import json
with open(data_file) as f:
    raw = json.load(f)

if isinstance(raw, list):
    records = raw
else:
    import pandas as pd
    records = pd.DataFrame(raw).to_dict(orient="records")

has_area = "area_name" in records[0] if records else False
print(f"area_name column exists: {has_area}")

if has_area:
    from collections import Counter
    dist = Counter(r.get("area_name") for r in records if r.get("area_name"))
    print(f"Unique areas: {len(dist)}")
    # Test the exact filter
    test_area = "Njësia Bashkiake Nr. 6"
    matched = [r for r in records if isinstance(r.get("area_name"), str)
               and r["area_name"].lower() == test_area.lower()]
    print(f"Filter test '{test_area}': {len(matched)} matches (expected ~336)")
    if len(matched) < 10:
        print("  ✗ Too few matches — re-run assign_areas.py")
    else:
        print("  ✓ Data is correct")
else:
    print("✗ area_name MISSING — you must run assign_areas.py first!")
    print("  cd backend && python3 assign_areas.py")

# ── 4. Summary ────────────────────────────────────────────────────────────────
print("\n=== Next steps ===")
print("1. If area_name was missing above, run:  python3 assign_areas.py")
print("2. Restart uvicorn:  uvicorn main:app --reload --port 8000")
print("3. Check server log for:  [loader] area_name: 17 OSM areas")
print("4. Test directly:  curl 'http://127.0.0.1:8000/listings?area_name=Nj%C3%ABsia%20Bashkiake%20Nr.%206&per_page=5'")
print("   Should show total ~336, not ~4120")