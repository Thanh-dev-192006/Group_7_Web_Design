# ER Diagram - Location (Current Schema)

**Figure caption:** Entity-Relationship Diagram of the Current SQLite Database Schema.

The current SQLite database contains one implemented table, `Location`, defined in `app/models.py`. It stores stable location metadata: `id` (`INTEGER`, primary key), `name` (`VARCHAR`, required and unique), `slug` (`VARCHAR`, required, unique and indexed), `region` (`VARCHAR`, required), `lat` (`FLOAT`, required), and `lon` (`FLOAT`, required). The model does not currently define a relationship to another implemented table.

Weather forecast and air-quality data are retrieved from **Open-Meteo, a third-party data provider**, and cached by `WeatherService` in an in-memory `TTLCache` for 15 minutes (900 seconds). These Weather/AQI payloads are not stored in SQLite. This design keeps frequently changing external data out of the persistent relational schema while reducing repeated API requests and improving response time for cache hits.

The trade-offs are that cached values are lost when the application process restarts, each application process/worker maintains its own independent cache, and the current implementation does not preserve historical weather or air-quality readings.

`Reading` is intentionally excluded from the current ER diagram: its model definition is commented out in `app/models.py` and marked **Phase 2 / not implemented**. A future implementation may introduce a one-to-many relationship from `Location` to `Reading` through `Reading.location_id`, but that relationship does not exist in the current database schema.
