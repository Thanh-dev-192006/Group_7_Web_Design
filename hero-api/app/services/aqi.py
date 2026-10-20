"""Phân mức AQI — logic duy nhất, frontend KHÔNG tự tính lại.

Dùng chỉ số `us_aqi` mà Open-Meteo trả về (thang US EPA 0–500).
Màu tương ứng nằm ở frontend/css/style.css (biến --aqi-*).
"""
from app.schemas import AqiCategory

# (ngưỡng trên, category) — giá trị <= ngưỡng thuộc category đó
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
