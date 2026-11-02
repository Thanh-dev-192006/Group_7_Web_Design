"""Thread-safe in-memory TTL cache. Per-process: with multiple workers each has its own cache."""
import threading
import time
from collections.abc import Callable
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.ttl = ttl_seconds
        self._clock = clock          # injectable so tests can fake time
        self._data: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key) -> tuple[bool, Any]:
        """Return (hit, value); hit is False if missing or expired."""
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return False, None
            expires_at, value = item
            if self._clock() >= expires_at:
                del self._data[key]
                return False, None
            return True, value

    def set(self, key, value) -> None:
        with self._lock:
            self._data[key] = (self._clock() + self.ttl, value)

    def get_or_set(self, key, factory: Callable[[], Any]) -> tuple[Any, bool]:
        """Return (value, cached); call `factory()` on a miss. Nothing is stored if it raises."""
        hit, value = self.get(key)
        if hit:
            return value, True
        value = factory()
        self.set(key, value)
        return value, False

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            now = self._clock()
            return sum(1 for expires_at, _ in self._data.values() if expires_at > now)
