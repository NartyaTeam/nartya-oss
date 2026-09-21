// Cloudflare by literal ip on purpose: no system dns lookup, so nothing to poison before
// the resolver itself can answer.
export const DOH_ENDPOINTS = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query"];
