// src/background.ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "resolve-lucky" || !msg.url) return;

  (async () => {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 7000);

      // Step 1: hit the Lucky URL
      let res = await fetch(msg.url, { redirect: "follow", signal: controller.signal });
      let target = res.url;

      // Unwrap Google's redirect interstitial: https://www.google.com/url?q=<real>
      const u = new URL(target);
      if (u.hostname.endsWith("google.com") && u.pathname === "/url") {
        const q = u.searchParams.get("q");
        if (q) target = q;
      }

      // Step 2: fetch the real page for its <title>
      res = await fetch(target, { redirect: "follow", signal: controller.signal });
      clearTimeout(to);

      const html = await res.text();
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = (m?.[1] || new URL(res.url).hostname).trim();

      sendResponse({ ok: true, url: res.url, title });
    } catch {
      sendResponse({ ok: false });
    }
  })();

  return true; // keep port open for async sendResponse
});
