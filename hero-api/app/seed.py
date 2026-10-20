"""Dữ liệu địa điểm ban đầu. Chạy tự động khi app khởi động (idempotent).

Chạy tay: python -m app.seed

Đây là các ĐIỂM ĐO theo thành phố (tọa độ trung tâm), không phải ranh giới
tỉnh — nên không bị ảnh hưởng khi địa giới hành chính thay đổi.
Thêm/bớt địa điểm: sửa LOCATIONS, giữ `slug` không đổi cho điểm đã có.
"""
from sqlmodel import Session, select

from app.models import Location

LOCATIONS: list[dict] = [
    {"name": "Hà Nội",          "slug": "ha-noi",          "region": "north",   "lat": 21.0285, "lon": 105.8542},
    {"name": "Hải Phòng",       "slug": "hai-phong",       "region": "north",   "lat": 20.8449, "lon": 106.6881},
    {"name": "Hạ Long",         "slug": "ha-long",         "region": "north",   "lat": 20.9712, "lon": 107.0448},
    {"name": "Thái Nguyên",     "slug": "thai-nguyen",     "region": "north",   "lat": 21.5942, "lon": 105.8482},
    {"name": "Lào Cai",         "slug": "lao-cai",         "region": "north",   "lat": 22.4809, "lon": 103.9755},
    {"name": "Vinh",            "slug": "vinh",            "region": "central", "lat": 18.6796, "lon": 105.6813},
    {"name": "Huế",             "slug": "hue",             "region": "central", "lat": 16.4637, "lon": 107.5909},
    {"name": "Đà Nẵng",         "slug": "da-nang",         "region": "central", "lat": 16.0544, "lon": 108.2022},
    {"name": "Quy Nhơn",        "slug": "quy-nhon",        "region": "central", "lat": 13.7820, "lon": 109.2197},
    {"name": "Nha Trang",       "slug": "nha-trang",       "region": "central", "lat": 12.2388, "lon": 109.1967},
    {"name": "Buôn Ma Thuột",   "slug": "buon-ma-thuot",   "region": "central", "lat": 12.6667, "lon": 108.0500},
    {"name": "Đà Lạt",          "slug": "da-lat",          "region": "central", "lat": 11.9404, "lon": 108.4583},
    {"name": "TP. Hồ Chí Minh", "slug": "tp-ho-chi-minh",  "region": "south",   "lat": 10.7769, "lon": 106.7009},
    {"name": "Vũng Tàu",        "slug": "vung-tau",        "region": "south",   "lat": 10.3460, "lon": 107.0843},
    {"name": "Cần Thơ",         "slug": "can-tho",         "region": "south",   "lat": 10.0452, "lon": 105.7469},
]


def seed_locations(session: Session) -> int:
    """Thêm các địa điểm chưa có (theo slug). Trả số bản ghi mới."""
    existing = set(session.exec(select(Location.slug)).all())
    new = [Location(**item) for item in LOCATIONS if item["slug"] not in existing]
    session.add_all(new)
    session.commit()
    return len(new)


if __name__ == "__main__":
    from app.database import engine, init_db

    init_db()
    with Session(engine) as session:
        print(f"Seeded {seed_locations(session)} new location(s).")
