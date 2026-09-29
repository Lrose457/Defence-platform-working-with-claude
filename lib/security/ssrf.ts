import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.azure.internal",
]);

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
  }

  return true;
}

export async function validateOutboundUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS targets are allowed.");
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("Target host is not allowed.");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Target IP is private or otherwise restricted.");
  }

  const addresses = await dns.lookup(hostname, { all: true });

  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Target resolves to a private or restricted network.");
  }

  return url;
}

export async function safeOutboundFetch(input: string, init?: RequestInit) {
  const url = await validateOutboundUrl(input);
  return fetch(url, {
    ...init,
    redirect: "error",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
}
