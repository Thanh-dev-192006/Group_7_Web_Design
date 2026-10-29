"""Cache trong bộ nhớ có thời hạn (TTL), an toàn khi nhiều request đồng thời.

Đủ cho 1 tiến trình uvicorn. Nếu sau này chạy nhiều worker thì mỗi worker
có cache riêng — chấp nhận được ở quy mô đồ án.
"""
import threading
import time
from collections.abc import Callable
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.ttl = ttl_seconds
        self._clock = clock          # inject được trong test để giả lập thời gian
        self._data: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key) -> tuple[bool, Any]:
        """Trả (hit, value). hit=False nếu không có hoặc đã hết hạn."""
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
        """Trả (value, cached). Gọi `factory()` khi cache miss.
        Nếu factory raise lỗi thì không lưu gì vào cache."""
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
