"""Real WeatherService against fake Open-Meteo payloads (httpx.MockTransport); no network."""
import concurrent.futures
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.config import settings
from app.errors import UpstreamError, UpstreamUnavailable
from app.models import Location
from app.services.air_quality import normalise
from app.services.cache import TTLCache
from app.services.open_meteo import OpenMeteoClient
from app.services.weather import WeatherService

LOCATION_2 = Location(id=2, name="Đà Nẵng", slug="da-nang", region="central", lat=16.0, lon=108.2)

# Fixed "now": 2026-10-28 14:30 UTC, so the forecast must start at 14:00.
NOW = datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)
FIRST_HOUR = datetime(2026, 10, 28, 0, 0)          # payload starts at 00:00 the same day
LOCATION = Location(id=1, name="Hà Nội", slug="ha-noi", region="north", lat=21.0, lon=105.8)


def hours(n: int):
    return [(FIRST_HOUR + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(n)]


def forecast_payload(n_hours: int = 192, n_days: int = 8) -> dict:
    return {
        "current": {
            "time": "2026-10-28T14:30", "temperature_2m": 30.5, "relative_humidity_2m": 70,
            "apparent_temperature": 34.0, "is_day": 1, "precipitation": 0.0, "weather_code": 2,
            "wind_speed_10m": 9.4, "wind_direction_10m": 120,
        },
        "hourly": {
            "time": hours(n_hours),
            "temperature_2m": [20 + i * 0.1 for i in range(n_hours)],
            "precipitation_probability": [10] * n_hours,
            "precipitation": [0.0] * n_hours,
            "weather_code": [1] * n_hours,
        },
        "daily": {
            "time": [(FIRST_HOUR + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n_days)],
            "weather_code": [61] * n_days,
            "temperature_2m_max": [32.0] * n_days,
            "temperature_2m_min": [24.0] * n_days,
            "precipitation_sum": [1.5] * n_days,
            "precipitation_probability_max": [60] * n_days,
        },
    }


def air_payload(n_hours: int = 168) -> dict:
    return {
        "current": {"time": "2026-10-28T14:30", "pm2_5": 40.0, "us_aqi": 108},
        "hourly": {"time": hours(n_hours), "pm2_5": [40.0] * n_hours, "us_aqi": [108] * n_hours},
    }


def make_service(handler, calls=None) -> WeatherService:
    def wrapped(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request.url.host)
        return handler(request)

    http = httpx.Client(transport=httpx.MockTransport(wrapped))
    return WeatherService(client=OpenMeteoClient(http), cache=TTLCache(60), clock=lambda: NOW)


def ok_handler(forecast=None, air=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host.startswith("air-quality"):
            return httpx.Response(200, json=air if air is not None else air_payload())
        return httpx.Response(200, json=forecast if forecast is not None else forecast_payload())
    return handler


def test_current_maps_weather_and_air_quality():
    data, cached = make_service(ok_handler()).current(LOCATION)
    assert cached is False
    assert data.temperature_c == 30.5
    assert data.humidity_pct == 70
    assert data.is_day is True
    assert data.observed_at == datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)
    assert data.us_aqi == 108 and data.aqi_category == "unhealthy_sensitive"


def test_current_missing_value_stays_none_not_zero():
    payload = forecast_payload()
    payload["current"]["wind_speed_10m"] = None
    del payload["current"]["precipitation"]
    data, _ = make_service(ok_handler(forecast=payload)).current(LOCATION)
    assert data.wind_speed_kmh is None
    assert data.precipitation_mm is None


def test_current_survives_air_quality_failure():
    def handler(request):
        if request.url.host.startswith("air-quality"):
            return httpx.Response(500, text="boom")
        return httpx.Response(200, json=forecast_payload())

    data, _ = make_service(handler).current(LOCATION)
    assert data.temperature_c == 30.5
    assert data.us_aqi is None and data.aqi_category is None


def test_forecast_starts_at_current_hour_and_has_168_points():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=168, days=7)
    # 192-hour payload from 00:00; dropping the first 14 leaves 178, trimmed to 168
    assert data.hourly[0].time == datetime(2026, 10, 28, 14, 0, tzinfo=timezone.utc)
    assert len(data.hourly) == 168
    assert len(data.daily) == 7


def test_forecast_hours_168_with_days_3_is_not_truncated_by_days():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=168, days=3)
    assert len(data.hourly) == 168       # not limited by days
    assert len(data.daily) == 3


def test_forecast_trims_hours_and_days():
    data, _ = make_service(ok_handler()).forecast(LOCATION, hours=12, days=2)
    assert len(data.hourly) == 12
    assert len(data.daily) == 2


def test_forecast_air_quality_shorter_than_weather_gives_null_by_time_not_index():
    # Air quality covers only the first 24 hours: 14:00-23:00 have AQI, from 00:00 next day it is null.
    data, _ = make_service(ok_handler(air=air_payload(24))).forecast(LOCATION, hours=48, days=7)
    by_hour = {p.time.hour + 24 * (p.time.day - 28): p for p in data.hourly}
    assert by_hour[14].us_aqi == 108 and by_hour[14].aqi_category == "unhealthy_sensitive"
    assert by_hour[23].us_aqi == 108
    assert by_hour[24].us_aqi is None and by_hour[24].aqi_category is None
    assert by_hour[24].temperature_c is not None


def test_forecast_air_quality_offset_start_is_matched_by_time():
    air = air_payload(24)
    # Air quality starts at 14:00, so its index 0 is 14:00, not 00:00.
    air["hourly"]["time"] = hours(168)[14:38]
    air["hourly"]["us_aqi"] = list(range(1000, 1024))
    data, _ = make_service(ok_handler(air=air)).forecast(LOCATION, hours=3, days=1)
    assert [p.us_aqi for p in data.hourly] == [1000, 1001, 1002]


def test_forecast_uses_one_http_call_per_api_and_caches_across_params():
    calls: list[str] = []
    service = make_service(ok_handler(), calls)
    service.forecast(LOCATION, hours=48, days=7)
    _, cached = service.forecast(LOCATION, hours=24, days=1)
    assert cached is True
    assert len(calls) == 2               # 1 forecast + 1 air quality


def test_timeout_becomes_upstream_unavailable():
    def handler(request):
        raise httpx.ConnectTimeout("timeout")

    with pytest.raises(UpstreamUnavailable):
        make_service(handler).current(LOCATION)


def test_http_error_becomes_upstream_error():
    with pytest.raises(UpstreamError):
        make_service(lambda request: httpx.Response(500, text="boom")).forecast(LOCATION, hours=1, days=1)


def test_malformed_payload_becomes_upstream_error():
    with pytest.raises(UpstreamError):
        make_service(ok_handler(forecast={"unexpected": True})).current(LOCATION)
    with pytest.raises(UpstreamError):
        make_service(ok_handler(forecast={"unexpected": True})).forecast(LOCATION, hours=1, days=1)


def test_injected_empty_cache_is_kept():
    injected = TTLCache(60)
    service = WeatherService(client=OpenMeteoClient(httpx.Client()), cache=injected)
    assert service.cache is injected


def test_injected_client_is_kept():
    client = OpenMeteoClient(httpx.Client(transport=httpx.MockTransport(ok_handler())))
    assert WeatherService(client=client, cache=TTLCache(60)).client is client


def test_forecast_requests_one_extra_day_so_168_future_hours_exist():
    seen: list[str] = []

    def handler(request):
        if not request.url.host.startswith("air-quality"):
            seen.append(request.url.params["forecast_days"])
        return ok_handler()(request)

    make_service(handler).forecast(LOCATION, hours=168, days=7)
    assert seen == ["8"]


def test_cached_forecast_hourly_starts_at_serve_time_hour():
    now = [datetime(2026, 10, 28, 13, 50, tzinfo=timezone.utc)]
    calls: list[str] = []

    def wrapped(request):
        calls.append(request.url.host)
        return ok_handler()(request)

    service = WeatherService(
        client=OpenMeteoClient(httpx.Client(transport=httpx.MockTransport(wrapped))),
        cache=TTLCache(60),
        clock=lambda: now[0],
    )
    first, _ = service.forecast(LOCATION, hours=168, days=7)
    assert first.hourly[0].time == datetime(2026, 10, 28, 13, 0, tzinfo=timezone.utc)

    now[0] = datetime(2026, 10, 28, 14, 5, tzinfo=timezone.utc)
    second, cached = service.forecast(LOCATION, hours=168, days=7)
    assert cached is True
    assert len(calls) == 2               # no extra HTTP call
    assert second.hourly[0].time == datetime(2026, 10, 28, 14, 0, tzinfo=timezone.utc)
    assert len(second.hourly) == 168


def local_forecast_payload() -> dict:
    """Forecast in Asia/Ho_Chi_Minh: naive local times plus utc_offset_seconds=25200."""
    payload = forecast_payload()
    payload["utc_offset_seconds"] = 25200
    payload["current"]["time"] = "2026-10-28T21:30"
    return payload


def test_local_forecast_times_are_converted_to_utc():
    payload = local_forecast_payload()
    payload["hourly"]["time"][0] = "2026-11-05T07:00"
    service = make_service(ok_handler(forecast=payload))

    current, _ = service.current(LOCATION)
    assert current.observed_at == datetime(2026, 10, 28, 14, 30, tzinfo=timezone.utc)

    full = service._forecast_full(LOCATION)[0]
    assert full.hourly[0].time == datetime(2026, 11, 5, 0, 0, tzinfo=timezone.utc)
    assert full.hourly[1].time == datetime(2026, 10, 27, 18, 0, tzinfo=timezone.utc)   # local 01:00 on the 28th
    assert full.daily[0].date.isoformat() == "2026-10-28"                             # daily dates stay as sent


def test_air_quality_still_joins_by_utc_time_after_conversion():
    payload = local_forecast_payload()
    # Local 2026-10-28T07:00 == 2026-10-28T00:00Z, the first air-quality hour.
    air = air_payload()
    air["hourly"]["us_aqi"] = [100 + i for i in range(168)]
    service = make_service(ok_handler(forecast=payload, air=air))

    full = service._forecast_full(LOCATION)[0]
    by_time = {p.time: p for p in full.hourly}
    assert by_time[datetime(2026, 10, 28, 0, 0, tzinfo=timezone.utc)].us_aqi == 100
    assert by_time[datetime(2026, 10, 28, 5, 0, tzinfo=timezone.utc)].us_aqi == 105
    assert by_time[datetime(2026, 10, 27, 18, 0, tzinfo=timezone.utc)].us_aqi is None   # before the air-quality range


def test_forecast_requests_local_timezone_and_air_quality_gmt():
    params = {}

    def handler(request: httpx.Request) -> httpx.Response:
        kind = "air" if request.url.host.startswith("air-quality") else "forecast"
        params[kind] = dict(request.url.params)
        return ok_handler()(request)

    make_service(handler).forecast(LOCATION, hours=48, days=7)
    assert params["forecast"]["timezone"] == "Asia/Ho_Chi_Minh"
    assert params["air"]["timezone"] == "GMT"


def test_extra_hourly_and_daily_fields_are_mapped():
    payload = local_forecast_payload()
    payload["hourly"].update({
        "apparent_temperature": [30.0 + i for i in range(192)],
        "relative_humidity_2m": [80] * 192,
        "wind_speed_10m": [12.5] * 192,
        "uv_index": [0.0, 1.5] + [3.0] * 190,
    })
    payload["daily"].update({
        "sunrise": ["2026-11-05T05:58"] + [None] * 7,
        "sunset": ["2026-11-05T17:12"] + [None] * 7,
        "uv_index_max": [8.1] * 8,
    })
    full = make_service(ok_handler(forecast=payload))._forecast_full(LOCATION)[0]

    hour = full.hourly[1]
    assert (hour.apparent_temperature_c, hour.relative_humidity_pct, hour.wind_speed_kmh, hour.uv_index) == (31.0, 80, 12.5, 1.5)
    day = full.daily[0]
    assert day.sunrise == datetime(2026, 11, 4, 22, 58, tzinfo=timezone.utc)   # local 05:58 at UTC+7
    assert day.sunset == datetime(2026, 11, 5, 10, 12, tzinfo=timezone.utc)
    assert day.uv_index_max == 8.1
    assert full.daily[1].sunrise is None and full.daily[1].sunset is None


def test_missing_extra_columns_are_none():
    full = make_service(ok_handler())._forecast_full(LOCATION)[0]
    hour = full.hourly[0]
    assert hour.apparent_temperature_c is None and hour.relative_humidity_pct is None
    assert hour.wind_speed_kmh is None and hour.uv_index is None
    day = full.daily[0]
    assert day.sunrise is None and day.sunset is None and day.uv_index_max is None


def test_forecast_request_asks_for_the_extra_variables():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if not request.url.host.startswith("air-quality"):
            seen.update(request.url.params)
        return ok_handler()(request)

    make_service(handler).forecast(LOCATION, hours=48, days=7)
    for name in ("apparent_temperature", "relative_humidity_2m", "wind_speed_10m", "uv_index"):
        assert name in seen["hourly"].split(",")
    for name in ("sunrise", "sunset", "uv_index_max"):
        assert name in seen["daily"].split(",")


def test_current_and_forecast_requests_ask_for_separate_blocks():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if not request.url.host.startswith("air-quality"):
            seen.append(dict(request.url.params))
        return ok_handler()(request)

    service = make_service(handler)
    service.current(LOCATION)
    current_params = seen[-1]
    assert "current" in current_params
    assert "hourly" not in current_params and "daily" not in current_params
    assert current_params["timezone"] == "Asia/Ho_Chi_Minh"

    service._forecast_full(LOCATION)[0]
    forecast_params = seen[-1]
    assert "hourly" in forecast_params and "daily" in forecast_params
    assert "current" not in forecast_params


# ---------- Air-quality layer: shared fetch, failure cooldown, stale fallback ----------
class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def aq_service(aq_status, clock, aq_calls, aq_ttl=3600, stale_max=21600, cooldown=300, aq_body=None):
    """Service whose air-quality reply is controlled via `aq_status[0]` (200, an error status or "timeout")
    and `aq_body[0]` (the 200 JSON body; None means a valid default payload)."""
    aq_body = aq_body if aq_body is not None else [None]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host.startswith("air-quality"):
            aq_calls.append(dict(request.url.params))
            if aq_status[0] == "timeout":
                raise httpx.ConnectTimeout("timeout")
            if aq_status[0] != 200:
                return httpx.Response(aq_status[0], text="rate limited")
            return httpx.Response(200, json=aq_body[0] if aq_body[0] is not None else air_payload())
        return ok_handler()(request)

    return WeatherService(
        client=OpenMeteoClient(httpx.Client(transport=httpx.MockTransport(handler))),
        cache=TTLCache(900, clock=clock),
        air_quality_cache=TTLCache(aq_ttl, clock=clock),
        clock=lambda: NOW,
        monotonic=clock,
        air_quality_stale_max_seconds=stale_max,
        air_quality_failure_cooldown_seconds=cooldown,
    )


def test_current_and_forecast_share_one_air_quality_call():
    calls: list[str] = []
    service = make_service(ok_handler(), calls)
    service.current(LOCATION)
    service.forecast(LOCATION, hours=48, days=7)
    assert calls.count("air-quality-api.open-meteo.com") == 1
    assert len(calls) == 3               # current + forecast + 1 air quality


def test_air_quality_request_uses_configured_forecast_days(monkeypatch):
    monkeypatch.setattr(settings, "air_quality_forecast_days", 5)
    aq_calls: list[dict] = []
    aq_service([200], FakeClock(), aq_calls).current(LOCATION)
    assert aq_calls[0]["forecast_days"] == "5"


def test_air_quality_429_is_not_cached_and_recovers_after_cooldown():
    clock, aq_calls, status = FakeClock(), [], [429]
    service = aq_service(status, clock, aq_calls)
    data, cached = service.current(LOCATION)
    assert data.temperature_c == 30.5 and data.us_aqi is None
    assert cached is False and len(aq_calls) == 1

    status[0] = 200
    clock.now += 301                      # cooldown over, weather (900 s) still cached
    data, cached = service.current(LOCATION)
    assert len(aq_calls) == 2
    assert data.us_aqi == 108 and cached is False   # an AQ HTTP call was made


def test_air_quality_cooldown_skips_all_locations():
    clock, aq_calls = FakeClock(), []
    service = aq_service([429], clock, aq_calls)
    service.current(LOCATION)
    assert len(aq_calls) == 1
    clock.now += 100                      # still inside the 300 s cooldown
    service.current(LOCATION_2)
    service.forecast(LOCATION, hours=24, days=1)
    service.forecast(LOCATION_2, hours=24, days=1)
    assert len(aq_calls) == 1


def test_cached_flag_true_when_no_http_call_even_during_cooldown():
    clock, aq_calls = FakeClock(), []
    service = aq_service([429], clock, aq_calls)
    service.current(LOCATION)
    _, cached = service.current(LOCATION)         # weather cached, AQ skipped by cooldown
    assert cached is True


def test_stale_air_quality_served_on_failure_until_stale_max():
    clock, aq_calls, status = FakeClock(), [], [200]
    service = aq_service(status, clock, aq_calls, aq_ttl=3600, stale_max=21600, cooldown=300)
    assert service.current(LOCATION)[0].us_aqi == 108

    status[0] = 429
    clock.now += 3601                     # AQ TTL expired; last-good is 1 h old
    data, _ = service.current(LOCATION)
    assert len(aq_calls) == 2
    assert data.us_aqi == 108 and data.aqi_category == "unhealthy_sensitive"
    fc, _ = service.forecast(LOCATION, hours=3, days=1)
    assert fc.hourly[0].us_aqi == 108     # also stale during cooldown, no new call
    assert len(aq_calls) == 2

    clock.now += 21600                    # last-good now older than stale max (cooldown long over)
    data, _ = service.current(LOCATION)
    assert data.us_aqi is None and data.aqi_category is None
    assert len(aq_calls) == 3             # upstream was retried (and failed) once more


def test_stale_air_quality_expires_inside_cooldown_without_new_call():
    clock, aq_calls, status = FakeClock(), [], [200]
    service = aq_service(status, clock, aq_calls, aq_ttl=50, stale_max=100, cooldown=300)
    service.current(LOCATION)
    status[0] = 429
    clock.now += 60                       # AQ TTL over; fails; last-good 60 s old < 100
    assert service.current(LOCATION)[0].us_aqi == 108
    clock.now += 90                       # 150 s old > stale max, still inside the 300 s cooldown
    assert service.current(LOCATION)[0].us_aqi is None
    assert len(aq_calls) == 2


def test_air_quality_refetched_after_ttl_expires():
    clock, aq_calls = FakeClock(), []
    service = aq_service([200], clock, aq_calls, aq_ttl=3600)
    service.current(LOCATION)
    clock.now += 3599
    service.current(LOCATION)
    assert len(aq_calls) == 1
    clock.now += 2
    _, cached = service.current(LOCATION)
    assert len(aq_calls) == 2 and cached is False


@pytest.mark.parametrize("bad", [
    {"hourly": {"time": ["garbage"], "us_aqi": [1], "pm2_5": [1]}},     # bad time string
    [1, 2, 3],                                                          # body is a list
    {"current": {"us_aqi": "high", "pm2_5": 3}},                        # string instead of number
    {"hourly": {"time": hours(2), "us_aqi": [1, "x"], "pm2_5": [1, 2]}},
    {"hourly": "nope"},
])
def test_malformed_air_quality_is_a_failure_not_cached(bad):
    clock, aq_calls, body = FakeClock(), [], [bad]
    service = aq_service([200], clock, aq_calls, aq_body=body)
    data, _ = service.current(LOCATION)
    assert data.temperature_c == 30.5 and data.us_aqi is None
    fc, _ = service.forecast(LOCATION, hours=3, days=1)       # cooldown: no new call, no exception
    assert fc.hourly[0].us_aqi is None and len(aq_calls) == 1

    body[0] = None                                            # upstream is healthy again
    clock.now += 301
    assert service.current(LOCATION)[0].us_aqi == 108
    assert len(aq_calls) == 2


@pytest.mark.parametrize("empty", [{}, {"current": {}, "hourly": {}}, {"current": {"us_aqi": None, "pm2_5": None}}])
def test_empty_air_quality_does_not_overwrite_last_good(empty):
    clock, aq_calls, body = FakeClock(), [], [None]
    service = aq_service([200], clock, aq_calls, aq_ttl=100, aq_body=body)
    assert service.current(LOCATION)[0].us_aqi == 108
    body[0] = empty
    clock.now += 101
    assert service.current(LOCATION)[0].us_aqi == 108          # last-good kept
    assert len(aq_calls) == 2
    service.current(LOCATION)                                  # empty reply was not cached; cooldown active
    assert len(aq_calls) == 2
    clock.now += 301
    service.current(LOCATION)
    assert len(aq_calls) == 3                                  # retried, so the empty reply was not cached


def test_air_quality_timeout_starts_cooldown():
    clock, aq_calls = FakeClock(), []
    service = aq_service(["timeout"], clock, aq_calls)
    service.current(LOCATION)
    service.current(LOCATION_2)
    assert len(aq_calls) == 1


def test_air_quality_4xx_other_than_429_backs_off_per_location_only(caplog):
    clock, aq_calls = FakeClock(), []
    service = aq_service([400], clock, aq_calls, cooldown=300)
    with caplog.at_level("ERROR", logger="app.services.weather"):
        service.current(LOCATION)
        assert len(aq_calls) == 1
        service.current(LOCATION_2)                  # no global cooldown: other locations are still fetched
        assert len(aq_calls) == 2
        service.current(LOCATION)                    # same location inside its window: no call
        service.forecast(LOCATION, hours=3, days=1)
        assert len(aq_calls) == 2
        clock.now += 301                             # window over
        service.current(LOCATION)
    assert len(aq_calls) == 3
    assert any(r.levelname == "ERROR" for r in caplog.records)


def test_air_quality_5xx_starts_cooldown():
    clock, aq_calls = FakeClock(), []
    service = aq_service([503], clock, aq_calls)
    service.current(LOCATION)
    service.current(LOCATION)
    assert len(aq_calls) == 1


def test_current_many_makes_no_air_quality_calls_during_cooldown():
    clock, aq_calls = FakeClock(), []
    service = aq_service([429], clock, aq_calls)
    service.current(LOCATION)
    result = service.current_many([LOCATION, LOCATION_2])
    assert len(aq_calls) == 1
    assert [r.us_aqi for r in result] == [None, None]
    assert result.cached is False        # LOCATION_2 weather was fetched


def test_cached_weather_objects_are_never_mutated_by_merge():
    service = make_service(ok_handler())
    data, _ = service.current(LOCATION)
    assert data.us_aqi == 108
    _, cached_current = service.cache.get(("current", LOCATION.id))
    assert cached_current.us_aqi is None and cached_current.pm2_5 is None
    service.forecast(LOCATION, hours=24, days=1)
    _, cached_forecast = service.cache.get(("forecast", LOCATION.id))
    assert all(p.us_aqi is None for p in cached_forecast.hourly)


def test_current_aqi_comes_from_the_current_hour_not_the_older_current_block():
    air = air_payload()
    air["current"] = {"time": "2026-10-28T09:00", "pm2_5": 1.0, "us_aqi": 50}    # older than the hourly value
    air["hourly"]["us_aqi"][14] = 130                                            # NOW is 14:30 -> hour 14:00
    data, _ = make_service(ok_handler(air=air)).current(LOCATION)
    assert data.us_aqi == 130


def test_current_aqi_falls_back_to_current_block_only_when_fresh():
    air = air_payload()
    air["hourly"]["time"] = hours(168)[48:]                    # hourly does not cover 2026-10-28
    air["current"] = {"time": "2026-10-28T14:00", "pm2_5": 9.0, "us_aqi": 77}
    clock, aq_calls, status, body = FakeClock(), [], [200], [air]
    service = aq_service(status, clock, aq_calls, aq_ttl=100, aq_body=body)
    assert service.current(LOCATION)[0].us_aqi == 77           # fresh fetch: fallback allowed
    status[0] = 429
    clock.now += 101
    assert service.current(LOCATION)[0].us_aqi is None         # last-good (stale): no fallback


def test_concurrent_current_and_forecast_make_one_air_quality_call():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host.startswith("air-quality"):
            time.sleep(0.2)
        return ok_handler()(request)

    service = make_service(handler, calls)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = [
            pool.submit(service.current, LOCATION),
            pool.submit(service.forecast, LOCATION, hours=24, days=1),
            pool.submit(service.current, LOCATION),
        ]
        for future in futures:
            future.result()                          # re-raises any thread error
    assert sum(1 for h in calls if h.startswith("air-quality")) == 1


def test_non_finite_air_quality_numbers_are_treated_as_missing():
    # httpx refuses to encode NaN/inf, so test the normaliser directly (real upstreams can send them as text).
    air = air_payload()
    air["hourly"]["us_aqi"][14] = float("nan")
    air["hourly"]["pm2_5"][14] = float("inf")
    air["current"] = {"time": "2026-10-28T14:00", "pm2_5": float("-inf"), "us_aqi": 77}
    normalised = normalise(air)
    assert normalised.hourly[datetime(2026, 10, 28, 14, tzinfo=timezone.utc)] == (None, None)
    assert normalised.current == (None, 77)
    assert normalised.at(datetime(2026, 10, 28, 14, tzinfo=timezone.utc)) is None     # empty hour -> fallback


def test_current_falls_back_to_current_block_when_hourly_aqi_is_null_at_current_hour():
    air = air_payload()
    air["hourly"]["us_aqi"][14] = None                       # pm2_5 is still present at 14:00
    air["current"] = {"time": "2026-10-28T14:00", "pm2_5": 40.0, "us_aqi": 108}
    data, _ = make_service(ok_handler(air=air)).current(LOCATION)
    assert data.us_aqi == 108 and data.aqi_category == "unhealthy_sensitive"


def test_get_weather_service_is_created_once_under_concurrency(monkeypatch):
    import app.services.weather as weather_module

    created: list[int] = []
    original_init = WeatherService.__init__

    def slow_init(self, *args, **kwargs):
        created.append(1)
        time.sleep(0.1)                                      # make the threads overlap
        original_init(self, *args, **kwargs)

    monkeypatch.setattr(weather_module, "_service", None)
    monkeypatch.setattr(WeatherService, "__init__", slow_init)
    results, errors = [], []

    def worker():
        try:
            results.append(weather_module.get_weather_service())
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    assert len(created) == 1
    assert len(results) == 8 and all(r is results[0] for r in results)
