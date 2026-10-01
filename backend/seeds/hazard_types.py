"""Initial hazard types. Mirrors packages/shared/src/hazards.ts.

Hazard types live in the database, so MDRRMO can add more without a code change.
"""

DEFAULT_HAZARD_TYPES: list[tuple[str, str]] = [
    ("flood", "Flood"),
    ("landslide", "Landslide"),
    ("earthquake", "Earthquake"),
    ("typhoon", "Typhoon"),
    ("storm_surge", "Storm Surge"),
    ("strong_winds", "Strong Winds"),
    ("heavy_rainfall", "Heavy Rainfall"),
    ("fire", "Fire"),
    ("other", "Other Hazard"),
]
