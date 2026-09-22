// Pwned Passwords, queried with k-anonymity: the password never leaves the machine, only
// the first five characters of its sha-1. See password-safety.ts.
export const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";

// Turnstile, rendered inline when the app runs in a browser. The packaged app cannot: its
// origin is file://, which Cloudflare refuses, so it serves its own page on loopback.
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
