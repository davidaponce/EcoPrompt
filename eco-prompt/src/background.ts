// background.ts
// MV3 service worker: fetch Google HTML and return top 3 links

type LinkItem = { title: string; href: string }

const decodeHtml = (s: string) =>
  s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
   .replace(/&quot;/g,'"').replace(/&#39;/g,"'")

// Robust parser: handle both direct <a><h3> pairs and Google redirect links (/url?q=...)
const parseTopLinks = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []

  // 1) Direct <a><h3>Title</h3></a>
  const reH3 = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = reH3.exec(html)) && out.length < max) {
    const href = m[1]
    const title = decodeHtml(m[2].replace(/<[^>]*>/g, "").trim())
    if (!href || href.includes("/aclk") || href.includes("/ads")) continue
    out.push({ title, href })
  }

  // 2) Fallback: Google redirect links <a href="/url?q=TARGET&..."><h3>Title</h3></a>
  if (out.length < max) {
    const reUrl = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/gi
    while ((m = reUrl.exec(html)) && out.length < max) {
      try {
        const href = decodeURIComponent(m[1])
        const title = decodeHtml(m[2].replace(/<[^>]*>/g, "").trim())
        if (!href) continue
        out.push({ title, href })
      } catch { /* ignore */ }
    }
  }

  return out
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "eco_google_search" || typeof msg.q !== "string") return

  ;(async () => {
    try {
      const url = new URL("https://www.google.com/search")
      url.searchParams.set("q", msg.q)
      url.searchParams.set("hl", "en")
      url.searchParams.set("num", "10")   // request more; we’ll keep top 3
      url.searchParams.set("pws", "0")    // don’t personalize

      const res = await fetch(url.toString(), {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          // User-Agent isn’t settable here; Chrome sets a proper UA already.
        }
      })

      const html = await res.text()
      const links = parseTopLinks(html, 3)
      console.log("[EcoPrompt SW] fetched google links:", links)
      sendResponse({ ok: true, links })
    } catch (e) {
      console.error("[EcoPrompt SW] fetch error:", e)
      sendResponse({ ok: false, error: String(e) })
    }
  })()

  return true // keep port open for async response
})
