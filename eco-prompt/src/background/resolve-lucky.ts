// Resolves the final URL for a Google "I'm Feeling Lucky" link.
// Requires host_permissions for https://*.google.com/*

export {}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "resolve-lucky" || !msg.url) return

  ;(async () => {
    try {
      const res = await fetch(msg.url, { redirect: "manual" })
      const loc = res.headers.get("location")

      // Prefer the Location header; if the fetch auto-followed, use res.url
      if (loc) {
        sendResponse({ ok: true, url: loc })
      } else if (res.url && res.url !== msg.url) {
        sendResponse({ ok: true, url: res.url })
      } else {
        sendResponse({ ok: false })
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) })
    }
  })()

  // Tell Chrome we’ll reply asynchronously
  return true
})
