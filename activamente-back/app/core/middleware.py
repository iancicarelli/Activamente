"""Middleware de hardening (stack de seguridad, 2026-09-17).

RejectNulBytesMiddleware: Postgres no acepta el carácter NUL (0x00) en texto y
psycopg2 lanza ValueError → 500 en cualquier endpoint que guarde strings. Se
rechaza antes de tocar la base, con 422, mirando path, query string y body
(tanto el byte 0x00 crudo como la secuencia JSON `\\u0000`).
"""

import json

from starlette.types import ASGIApp, Receive, Scope, Send

_DETAIL = "Los datos contienen caracteres no permitidos."


class RejectNulBytesMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if "\x00" in scope.get("path", "") or b"%00" in scope.get("query_string", b"").lower():
            await self._reject(send)
            return

        # Cuerpos JSON: pequeños, se leen completos y se reinyectan.
        chunks: list[bytes] = []
        while True:
            message = await receive()
            if message["type"] != "http.request":
                await self.app(scope, receive, send)
                return
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)

        if b"\x00" in body or b"\\u0000" in body.lower():
            await self._reject(send)
            return

        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)

    @staticmethod
    async def _reject(send: Send) -> None:
        payload = json.dumps({"detail": _DETAIL}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 422,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode())],
            }
        )
        await send({"type": "http.response.body", "body": payload})
