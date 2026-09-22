import { TURNSTILE_SCRIPT_URL } from "./endpoints.mts";

// A site key is public, but it lands in a page we build, so only its own alphabet passes.
const SITE_KEY = /^[A-Za-z0-9_-]{8,64}$/;

export function isSiteKey(value: unknown): value is string {
  return typeof value === "string" && SITE_KEY.test(value);
}

const STYLE =
  "html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;" +
  "text-align:center;font-family:system-ui,sans-serif;background:#0b0b0f;color:#f5f5f7}" +
  ".card{max-width:440px;padding:40px 28px}h1{font-size:20px;margin:0 0 10px}" +
  "p{font-size:14px;color:#a1a1aa;margin:0 0 20px;line-height:1.6}" +
  "#box{display:flex;justify-content:center}";

// Served from the loopback server rather than a page on some domain: Cloudflare refuses a
// file:// origin, but 127.0.0.1 can be allowed on the key, so the app carries its own page.
export function captchaPage(siteKey: string, postTo: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vérification</title><style>${STYLE}</style>
<script src="${TURNSTILE_SCRIPT_URL}?render=explicit" async defer></script></head>
<body><main class="card">
<h1>Vérification anti-robot</h1>
<p id="say">Un instant, la vérification se fait toute seule la plupart du temps.</p>
<div id="box"></div>
</main>
<script>
window.onloadTurnstileCallback = function () {
  window.turnstile.render("#box", {
    sitekey: ${JSON.stringify(siteKey)},
    callback: function (token) {
      fetch(${JSON.stringify(postTo)} + "?token=" + encodeURIComponent(token))
        .then(function () {
          document.getElementById("say").textContent =
            "C'est bon. Vous pouvez fermer cet onglet et revenir à l'application.";
          document.getElementById("box").innerHTML = "";
          setTimeout(function () { try { window.close() } catch (e) {} }, 800);
        });
    },
    "error-callback": function () {
      document.getElementById("say").textContent =
        "La vérification a échoué. Fermez cet onglet et réessayez depuis l'application.";
    },
  });
};
var waiting = setInterval(function () {
  if (!window.turnstile) return;
  clearInterval(waiting);
  window.onloadTurnstileCallback();
}, 50);
</script>
</body></html>`;
}
