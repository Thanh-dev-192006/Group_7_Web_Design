"""AQI categorisation from Open-Meteo's `us_aqi` (US EPA 0-500); the frontend must not recompute it.
Colors live in frontend/css/style.css (--aqi-* variables).
"""
from app.schemas import AqiCategory

# (upper bound, category); a value <= the bound belongs to that category
_US_AQI_BREAKPOINTS: list[tuple[float, AqiCategory]] = [
    (50, AqiCategory.good),
    (100, AqiCategory.moderate),
    (150, AqiCategory.unhealthy_sensitive),
    (200, AqiCategory.unhealthy),
    (300, AqiCategory.very_unhealthy),
]


def category_from_us_aqi(value: float | None) -> AqiCategory | None:
    if value is None or value < 0:
        return None
    for upper, category in _US_AQI_BREAKPOINTS:
        if value <= upper:
            return category
    return AqiCategory.hazardous
