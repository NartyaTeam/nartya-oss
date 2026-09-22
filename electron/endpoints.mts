// Cloudflare by literal ip on purpose: no system dns lookup, so nothing to poison before
// the resolver itself can answer.
export const DOH_ENDPOINTS = ["https://1.1.1.1/dns-query", "https://1.0.0.1/dns-query"];

// Public test streams, so the app plays something without the catalog api (D12). They
// are direct hls manifests: nothing to extract, no host to name.
export const DEMO_STREAMS = [
  {
    id: "demo-1",
    title: "Big Buck Bunny",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  {
    id: "demo-2",
    title: "Apple BipBop (fMP4)",
    url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
  },
];

// Turnstile, loaded by the captcha page the loopback server serves. The site key is public
// and comes from configuration, never from here.
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
