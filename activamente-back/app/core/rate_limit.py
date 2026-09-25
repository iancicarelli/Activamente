"""
Límite de intentos fallidos de login (SEC-05), en memoria.

Dos contadores de fallos en una ventana deslizante:
  - por IP + cuenta (LOGIN_MAX_FAILURES, 5): frena adivinar la clave de UNA cuenta, sin que un
    paciente que se equivoca bloquee a otros que comparten el wifi de un centro.
  - por IP (LOGIN_MAX_FAILURES_PER_IP, 50): frena probar pocas claves contra MUCHAS cuentas.
Un login correcto borra el contador de esa IP + cuenta.

La IP es `request.client.host`. Detrás de Caddy, uvicorn la reescribe con la de
`X-Forwarded-For` solo si la conexión viene de FORWARDED_ALLOW_IPS (la IP de Caddy); sin eso,
todas las peticiones tendrían la IP del proxy y 5 fallos de cualquiera bloquearían a todos.

En memoria a propósito: el backend corre en UN proceso uvicorn. Con varios workers o réplicas
cada uno contaría por su lado (habría que pasarlo a Postgres o Redis). Un reinicio lo vacía.
"""

import os
import threading
import time
from collections import deque

MAX_FAILURES = int(os.getenv("LOGIN_MAX_FAILURES", "5"))
MAX_FAILURES_PER_IP = int(os.getenv("LOGIN_MAX_FAILURES_PER_IP", "50"))
WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))
# Tope de claves guardadas: si se supera, se purgan las vencidas (acota memoria ante un barrido).
_PRUNE_ABOVE = 10_000


class LoginRateLimiter:
    def __init__(self, max_failures: int, max_failures_per_ip: int, window_seconds: int, clock=time.monotonic):
        self.max_failures = max_failures
        self.max_failures_per_ip = max_failures_per_ip
        self.window = window_seconds
        self._clock = clock
        self._failures: dict[tuple, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: tuple, now: float) -> deque[float]:
        q = self._failures.get(key)
        if q is None:
            return deque()
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            del self._failures[key]
        return q

    def retry_after(self, ip: str, account: str) -> int:
        """Segundos hasta poder reintentar, o 0 si no está bloqueado."""
        now = self._clock()
        with self._lock:
            waits = []
            for key, limit in (((ip, account), self.max_failures), ((ip,), self.max_failures_per_ip)):
                q = self._recent(key, now)
                if len(q) >= limit:
                    # Se libera cuando vence el fallo que dejó el contador en el límite.
                    waits.append(q[len(q) - limit] + self.window - now)
            return max(1, int(max(waits)) + 1) if waits else 0

    def record_failure(self, ip: str, account: str) -> None:
        now = self._clock()
        with self._lock:
            if len(self._failures) > _PRUNE_ABOVE:
                for key in list(self._failures):
                    self._recent(key, now)
            for key in ((ip, account), (ip,)):
                self._failures.setdefault(key, deque()).append(now)

    def reset(self, ip: str, account: str) -> None:
        with self._lock:
            self._failures.pop((ip, account), None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


login_limiter = LoginRateLimiter(MAX_FAILURES, MAX_FAILURES_PER_IP, WINDOW_SECONDS)
