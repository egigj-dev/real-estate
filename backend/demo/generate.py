"""Generate fictional fixtures for the demo; no real listings or market prices."""

import json
from pathlib import Path


def generate():
    rows = []
    for i in range(48):
        beds = 1 + i % 4
        sqm = 38 + (i * 13) % 125
        baths = 1 + int(beds > 2)
        price = sqm * (800 + (i % 7) * 95) + beds * 2500
        rows.append({
            "address": f"Demo Block {chr(65 + i % 4)}",
            "description": f"SYNTHETIC DEMO DATA. Fictional property {i + 1:02d}; not for sale. No real address or market valuation.",
            "price_eur": price, "area_sqm": sqm,
            "bedrooms": beds, "bathrooms": baths, "floor": i % 8,
            "furnishing_status": ["unfurnished", "fully_furnished", "partially_furnished"][i % 3],
            "property_type": "villa" if i % 6 == 0 else "apartment",
            "property_status": "demo_only", "city": "Demo City",
            "has_elevator": i % 2 == 0, "has_parking_space": i % 3 == 0,
            "has_garage": False, "has_carport": False,
            "has_garden": i % 6 == 0, "has_terrace": i % 4 == 0,
            "balconies": i % 3, "living_rooms": 1,
            "lat": None, "lng": None,
            "neighborhood_cluster": i % 3,
            "distance_from_center": round(0.5 + (i % 12) * 0.4, 2),
            "dist_to_nearest_center": round(0.1 + (i % 5) * 0.15, 2),
            "price_per_sqm": round(price / sqm, 2),
            "total_rooms": beds + baths + 1,
        })
    return rows


if __name__ == "__main__":
    path = Path(__file__).with_name("listings.json")
    path.write_text(json.dumps(generate(), indent=2) + "\n")
    print(f"Wrote {len(generate())} synthetic demo rows to {path}")
