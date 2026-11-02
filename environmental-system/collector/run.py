"""Phase 2: periodic collector (NOT implemented). Will run as a separate process: python -m collector.run

Plan:
1. Uncomment the `Reading` model in app/models.py.
2. Add `APScheduler>=3.10,<4` to requirements.txt (4.x changed the API).
3. Every 30-60 min, for each Location call OpenMeteoClient, compute is_anomaly, store a Reading (UTC).
4. Anomaly rule: PM2.5 up >50% vs the mean of the last 3-5 readings AND above a minimum absolute
   threshold, or us_aqi > 150. Implement as a pure function in app/services/anomaly.py.
5. Wrap each call in try/except + log so one location's failure doesn't stop the round.

Reuse the engine from app/database.py (WAL enabled).
"""


def main() -> None:
    raise SystemExit("Collector is not implemented yet (phase 2). See the docstring of collector/run.py.")


if __name__ == "__main__":
    main()
