// background.ts
// MV3 service worker: fetch Google HTML and return top 3 organic links

type LinkItem = { title: string; href: string }

// --- small utils ---
const decodeHtml = (s: string) =>
  s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
   .replace(/&quot;/g,'"').replace(/&#39;/g,"'")

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim()

const dedupe = <T,>(arr: T[], key: (x: T) => string) => {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of arr) {
    const k = key(it)
    if (!seen.has(k)) { seen.add(k); out.push(it) }
  }
  return out
}

const looksOrganic = (href: string) =>
  /^https?:\/\//.test(href) &&
  !href.includes("/aclk") &&
  !href.includes("/ads") &&
  !href.includes("googleusercontent.com") &&
  !href.includes("webcache.googleusercontent.com")

// --- parsers (try easiest first) ---

// 1) Basic HTML results (when gbv=1): <a href="/url?q=REAL&...">Title</a>
const parseBasicAnchors = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<a[^>]+href="\/url\?([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const qs = m[1]
    const titleRaw = stripTags(decodeHtml(m[2]))
    const params = new URLSearchParams(qs)
    const href = params.get("q") ? decodeURIComponent(params.get("q")!) : ""
    if (!href || !looksOrganic(href)) continue
    const title = titleRaw || href
    out.push({ title, href })
  }
  return out
}

// 2) Regular desktop HTML: <div class="yuRUbf"><a href="https://..."><h3>Title</h3></a></div>
const parseYuRUbf = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<div[^>]+class="[^"]*\byuRUbf\b[^"]*"[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*(?:<h3[^>]*>([\s\S]*?)<\/h3>)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const href = m[1]
    const title = stripTags(decodeHtml(m[2] || "")) || href
    if (!looksOrganic(href)) continue
    out.push({ title, href })
  }
  return out
}

// 3) Fallback: any <a href="https://..."><h3>Title</h3></a>
const parseH3Links = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const href = m[1]
    const title = stripTags(decodeHtml(m[2] || "")) || href
    if (!looksOrganic(href)) continue
    out.push({ title, href })
  }
  return out
}

const parseTopLinks = (html: string, max = 3): LinkItem[] => {
  let links =
    parseBasicAnchors(html, max) ||
    []

  if (links.length < max) links = links.concat(parseYuRUbf(html, max - links.length))
  if (links.length < max) links = links.concat(parseH3Links(html, max - links.length))

  // dedupe by href and trim to max
  return dedupe(links, (l) => l.href).slice(0, max)
}

// --- message handler ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "eco_google_search" || typeof msg.q !== "string") return

  ;(async () => {
    try {
      const url = new URL("https://www.google.com/search")
      url.searchParams.set("q", msg.q)
      url.searchParams.set("hl", "en")
      url.searchParams.set("num", "10")
      url.searchParams.set("pws", "0")      // no personalization
      url.searchParams.set("gbv", "1")      // basic HTML (easier parsing, reliable)

      const res = await fetch(url.toString(), {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache"
        }
      })

      const html = await res.text()
      const links = parseTopLinks(html, 3)

      // If Google served a consent/blocked page, try a second pass without gbv
      if (links.length === 0) {
        const url2 = new URL("https://www.google.com/search")
        url2.searchParams.set("q", msg.q)
        url2.searchParams.set("hl", "en")
        url2.searchParams.set("num", "10")
        url2.searchParams.set("pws", "0")
        const res2 = await fetch(url2.toString(), { method: "GET", credentials: "omit", cache: "no-store" })
        const html2 = await res2.text()
        const links2 = parseTopLinks(html2, 3)
        sendResponse({ ok: true, links: links2 })
        return
      }

      sendResponse({ ok: true, links })
    } catch (e) {
      sendResponse({ ok: false, error: String(e) })
    }
  })()

  return true // keep port open for async response
})
