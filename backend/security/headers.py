"""Framework-neutral HTTP security headers and session-cookie settings."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data: https:; "
        "connect-src 'self';"
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}

SESSION_COOKIE_OPTIONS = {
    "httponly": True,
    "secure": True,
    "samesite": "Strict",
}


def apply_security_headers(response: Any) -> Any:
    """Apply security headers to a response exposing a mutable ``headers`` map."""
    response.headers.update(SECURITY_HEADERS)
    return response


def security_headers_middleware(handler: Callable[[Any], Any]) -> Callable[[Any], Any]:
    """Wrap a request handler and apply security headers to every response."""
    def middleware(request: Any) -> Any:
        return apply_security_headers(handler(request))

    return middleware
