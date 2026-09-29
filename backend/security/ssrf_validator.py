"""Validation helpers for URLs fetched by OSINT integrations."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = frozenset({"http", "https"})
BLOCKED_HOSTNAMES = frozenset({
    "localhost",
    "localhost.localdomain",
    "metadata",
    "metadata.google.internal",
})
BLOCKED_METADATA_IP = ipaddress.ip_address("169.254.169.254")


class SSRFValidationError(ValueError):
    """Raised when an OSINT target resolves to a non-public destination."""


def _is_blocked_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return (
        ip == BLOCKED_METADATA_IP
        or ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_unspecified
        or ip.is_multicast
    )


def _resolve_public_addresses(hostname: str, port: int | None) -> None:
    try:
        addresses = socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise SSRFValidationError("Target hostname could not be resolved") from exc

    resolved_ips = {result[4][0] for result in addresses}
    if not resolved_ips:
        raise SSRFValidationError("Target hostname did not resolve to an address")

    blocked_ips = [address for address in resolved_ips if _is_blocked_ip(address)]
    if blocked_ips:
        raise SSRFValidationError("Target resolves to a blocked network address")


def validate_osint_target_url(url: str) -> str:
    """Validate and return an HTTP(S) OSINT target URL.

    Every resolved address is checked so a hostname cannot pass validation by
    resolving to a public address alongside a private one.
    """
    if not isinstance(url, str) or not url.strip():
        raise SSRFValidationError("Target URL must be a non-empty string")

    parsed = urlparse(url.strip())
    hostname = parsed.hostname
    if parsed.scheme.casefold() not in ALLOWED_SCHEMES:
        raise SSRFValidationError("Only HTTP and HTTPS targets are allowed")
    if not hostname:
        raise SSRFValidationError("Target URL must include a hostname")
    if parsed.username or parsed.password:
        raise SSRFValidationError("Target URL must not contain credentials")

    normalized_hostname = hostname.rstrip(".").casefold()
    if normalized_hostname in BLOCKED_HOSTNAMES:
        raise SSRFValidationError("Target hostname is blocked")

    try:
        port = parsed.port
    except ValueError as exc:
        raise SSRFValidationError("Target URL contains an invalid port") from exc

    try:
        literal_ip = ipaddress.ip_address(normalized_hostname)
    except ValueError:
        literal_ip = None

    if literal_ip is not None:
        if _is_blocked_ip(str(literal_ip)):
            raise SSRFValidationError("Target resolves to a blocked network address")
    else:
        _resolve_public_addresses(normalized_hostname, port)

    return url.strip()
