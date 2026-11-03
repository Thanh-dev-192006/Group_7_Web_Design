# Test Case Catalog 

This catalog covers the backend suite in `tests/` and the frontend unit suite in `frontend/tests/`. Each pytest parameterized AQI boundary is listed as its own test case. The results reflect the supplied test-run screenshots: 59 backend tests passed and 20 frontend tests passed.

| ID | Feature | Expected Result | Result |
|---|---|---|---|
| TC-01 | AQI categorization: missing value (`None`) | Returns no category (`None`). | PASS |
| TC-02 | AQI categorization: negative value (`-1`) | Returns no category (`None`). | PASS |
| TC-03 | AQI categorization: lower good boundary (`0`) | Returns `good`. | PASS |
| TC-04 | AQI categorization: upper good boundary (`50`) | Returns `good`. | PASS |
| TC-05 | AQI categorization: lower moderate boundary (`51`) | Returns `moderate`. | PASS |
| TC-06 | AQI categorization: upper moderate boundary (`100`) | Returns `moderate`. | PASS |
| TC-07 | AQI categorization: lower unhealthy-for-sensitive-groups boundary (`101`) | Returns `unhealthy_sensitive`. | PASS |
| TC-08 | AQI categorization: upper unhealthy-for-sensitive-groups boundary (`150`) | Returns `unhealthy_sensitive`. | PASS |
| TC-09 | AQI categorization: lower unhealthy boundary (`151`) | Returns `unhealthy`. | PASS |
| TC-10 | AQI categorization: upper unhealthy boundary (`200`) | Returns `unhealthy`. | PASS |
| TC-11 | AQI categorization: lower very-unhealthy boundary (`201`) | Returns `very_unhealthy`. | PASS |
| TC-12 | AQI categorization: upper very-unhealthy boundary (`300`) | Returns `very_unhealthy`. | PASS |
| TC-13 | AQI categorization: lower hazardous boundary (`301`) | Returns `hazardous`. | PASS |
| TC-14 | AQI categorization: upper hazardous boundary (`500`) | Returns `hazardous`. | PASS |
| TC-15 | TTL cache expiration | A value is returned from cache before its TTL expires and recomputed at the expiration time. | PASS |
| TC-16 | TTL cache failure handling | A failing factory raises its exception and the failed value is not cached. | PASS |
| TC-17 | Unknown API route error format | An unknown route returns HTTP 404 with the standard `NOT_FOUND` error code. | PASS |
| TC-18 | Health endpoint | Health response reports application and database status as `ok`. | PASS |
| TC-19 | Health cache count | Requesting current weather adds one cache entry, reflected by the health endpoint. | PASS |
| TC-20 | OpenAPI forecast validation documentation | Forecast documents HTTP 400, not 422, and the API docs endpoint responds successfully. | PASS |
| TC-21 | OpenAPI examples and operation descriptions | Required schemas include examples and every documented operation includes a summary and description. | PASS |
| TC-22 | Same-origin frontend serving | Root route responds with HTTP 200 and an HTML content type. | PASS |
| TC-23 | Location list response envelope | List endpoint returns `data` and `meta`, correct count/timestamp, and required location fields. | PASS |
| TC-24 | Location region filter | Filtering by `south` returns a non-empty list containing only south-region locations. | PASS |
| TC-25 | Invalid location region | Unsupported region returns HTTP 400 with `VALIDATION_ERROR`. | PASS |
| TC-26 | Read a known location | A location detail response matches the corresponding item in the location list. | PASS |
| TC-27 | Read an unknown location | Unknown ID returns HTTP 404 and the expected `LOCATION_NOT_FOUND` error body. | PASS |
| TC-28 | Non-integer location ID | Invalid path ID returns HTTP 400 with `VALIDATION_ERROR` on `path.location_id`. | PASS |
| TC-29 | Current weather for all locations | Returns one timestamped item per seeded location, ordered by ID, with matching metadata count. | PASS |
| TC-30 | Current weather skips one failing location | A single upstream location failure is omitted; remaining items and metadata count are correct. | PASS |
| TC-31 | Current weather when all locations fail | Returns HTTP 503 using the standard `UPSTREAM_UNAVAILABLE` error format. | PASS |
| TC-32 | Current weather aggregate caching | First response is uncached and the repeated response reports a cache hit. | PASS |
| TC-33 | Map current weather and air quality | Maps weather fields and AQI correctly, including observation time and `unhealthy_sensitive` category. | PASS |
| TC-34 | Missing current weather values | Missing/null wind and precipitation remain `None`, rather than being converted to zero. | PASS |
| TC-35 | Current weather survives air-quality failure | Weather data remains available while AQI fields become `None`. | PASS |
| TC-36 | Forecast starts at current hour and returns 168 hours | Hourly results start at the current hour, include 168 points, and daily results include seven days. | PASS |
| TC-37 | Hourly forecast length is independent of requested daily length | Requesting 168 hours and three daily values returns all 168 hourly points and three daily points. | PASS |
| TC-38 | Forecast trims requested hours and days | A 12-hour/two-day request returns exactly 12 hourly and two daily points. | PASS |
| TC-39 | Shorter AQI forecast aligns by time | AQI is present only for covered timestamps; later weather points remain present with null AQI. | PASS |
| TC-40 | Offset AQI forecast aligns by timestamp | AQI values beginning at a later timestamp are matched to weather points by time, not array index. | PASS |
| TC-41 | Forecast API call count and cache sharing | Forecast and air-quality APIs are each called once; different forecast parameters reuse the cached result. | PASS |
| TC-42 | Upstream timeout mapping | A client connection timeout raises `UpstreamUnavailable`. | PASS |
| TC-43 | Upstream HTTP error mapping | An upstream HTTP 500 response raises `UpstreamError`. | PASS |
| TC-44 | Malformed upstream payload mapping | Malformed current-weather and forecast payloads each raise `UpstreamError`. | PASS |
| TC-45 | Injected empty cache is retained | `WeatherService` uses the caller-provided empty cache instance. | PASS |
| TC-46 | Injected HTTP client is retained | `WeatherService` uses the caller-provided Open-Meteo client instance. | PASS |
| TC-47 | Forecast requests an extra weather day | A 168-hour forecast requests eight forecast days so enough future hourly data is available. | PASS |
| TC-48 | Cached forecast rolls forward to serve-time hour | A second request within cache TTL starts at the updated current hour, returns 168 points, and makes no extra API calls. | PASS |
| TC-49 | Current weather response and caching | Current endpoint returns the expected envelope, location/AQI/time fields, null for missing wind, and a cache hit on repeat. | PASS |
| TC-50 | Forecast respects hours and days parameters | Requesting 12 hours and three days returns those exact hourly and daily counts. | PASS |
| TC-51 | Forecast hours upper bound | An out-of-range hours value returns HTTP 400 and identifies `query.hours`. | PASS |
| TC-52 | Forecast hours lower bound | Zero hours returns HTTP 400 and identifies `query.hours`. | PASS |
| TC-53 | Unknown location weather request | Current weather request for an unknown location returns `LOCATION_NOT_FOUND`. | PASS |
| TC-54 | Forecast days upper bound | Requesting more than seven days returns HTTP 400 and identifies `query.days`. | PASS |
| TC-55 | Forecast requests share cache across parameters | Different valid hours/days parameters reuse a cache entry and invoke the service once. | PASS |
| TC-56 | Current endpoint upstream error | Upstream failure maps to HTTP 502 and `UPSTREAM_ERROR`, retaining the diagnostic message. | PASS |
| TC-57 | Current endpoint upstream unavailable | Upstream unavailability maps to HTTP 503 and `UPSTREAM_UNAVAILABLE`, retaining the diagnostic message. | PASS |
| TC-58 | Forecast endpoint upstream error | Upstream failure maps to HTTP 502 and `UPSTREAM_ERROR`, retaining the diagnostic message. | PASS |
| TC-59 | Forecast endpoint upstream unavailable | Upstream unavailability maps to HTTP 503 and `UPSTREAM_UNAVAILABLE`, retaining the diagnostic message. | PASS |
| TC-60 | Health advice exists for every AQI level | Every known AQI category returns non-empty advice for both the general and sensitive groups. | PASS |
| TC-61 | Unknown or missing AQI health-advice category | Unknown, missing, null, and inherited-property-like categories return `null`. | PASS |
| TC-62 | Health advice text for representative AQI levels | `good` and `hazardous` return the expected guidance for both groups. | PASS |
| TC-63 | Initial location URL priority | A valid `?city` URL value takes priority over a stored location ID. | PASS |
| TC-64 | Initial location stored-ID fallback | When no URL city is supplied, a valid stored ID is selected. | PASS |
| TC-65 | Initial location default | With neither URL city nor stored ID, the first available location is selected. | PASS |
| TC-66 | Invalid URL location fallback | Invalid, unknown, fractional, and empty URL values fall back to a valid stored ID. | PASS |
| TC-67 | Invalid URL and stored location fallback | When both URL and stored IDs are invalid, the first available location is selected. | PASS |
| TC-68 | Empty location list | No available locations returns `null`. | PASS |
| TC-69 | Rain probability threshold | Probability 59 does not alert; probability 60 produces a rain alert with matching time and probability. | PASS |
| TC-70 | Rain weather-code trigger without probability | A rain weather code triggers an alert even when probability is null; it is marked as code-triggered. | PASS |
| TC-71 | Rain alert text and probability display | Code-triggered rain omits the percentage, while threshold-triggered rain includes it. | PASS |
| TC-72 | Thunderstorm severity | Thunderstorm weather codes 95 and 99 produce a `storm` alert. | PASS |
| TC-73 | Rain alert look-ahead window | Events after the first 12 hours are ignored; an event within the window triggers an alert. | PASS |
| TC-74 | Empty or invalid rain-alert input | Empty, missing, or null hourly input returns `null`. | PASS |
| TC-75 | Rain alert text variants | Rain, storm, no-rain, and null-probability alerts produce their expected text. | PASS |
| TC-76 | Known frontend error-code messages | Every listed known error code maps to a non-empty user-facing message distinct from the raw backend message. | PASS |
| TC-77 | Unknown frontend error-code message | Unknown codes use the generic message and do not expose the raw error message. | PASS |
| TC-78 | Frontend TypeError message | A plain `TypeError` maps to the generic user-facing message. | PASS |
| TC-79 | Null or undefined frontend error | Null and undefined errors map to the generic user-facing message. | PASS |
