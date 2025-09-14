// src/background/index.ts
// Return top 3 *organic* Google results

type LinkItem = { title: string; href: string }

// ---------- helpers ----------
const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

const inSearchSection = (html: string) => {
  const m = /<div[^>]+id="search"[^>]*>([\s\S]*?)<\/div>\s*<footer/i.exec(html)
  return m?.[1] ?? html
}

const dedupe = <T,>(arr: T[], key: (x: T) => string) => {
  const seen = new Set<string>(), out: T[] = []
  for (const it of arr) {
    const k = key(it)
    if (!seen.has(k)) { seen.add(k); out.push(it) }
  }
  return out
}

const isBadGoogleHost = (h: string) =>
  /(^|\.)(google|gstatic|googleusercontent)\.[a-z.]+$/i.test(h) ||
  /(^|\.)(consent|policies|support)\.google\.[a-z.]+$/i.test(h)

const looksOrganic = (href: string) => {
  try {
    const u = new URL(href)
    const h = u.hostname.replace(/^www\./, "")
    if (isBadGoogleHost(h)) return false
    if (u.pathname === "/httpservice/retry/enablejs") return false
    if (href.includes("/aclk") || href.includes("/ads/")) return false
    return /^https?:\/\//.test(href)
  } catch { return false }
}

// ---------- parsers (run inside #search only) ----------
const parseYuRUbf = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<div[^>]+class="[^"]*\byuRUbf\b[^"]*"[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*(?:<h3[^>]*>([\s\S]*?)<\/h3>)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const href = decodeHtml(m[1])
    if (!looksOrganic(href)) continue
    const title = stripTags(decodeHtml(m[2] || "")) || href
    out.push({ title, href })
  }
  return out
}

const parseBasicAnchors = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<a[^>]+href="(?:https?:\/\/www\.google\.[^/]+)?\/url\?([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const sp = new URLSearchParams(m[1])
    const cand = sp.get("q") || sp.get("url")
    if (!cand) continue
    const href = decodeURIComponent(cand)
    if (!looksOrganic(href)) continue
    const title = stripTags(decodeHtml(m[2] || "")) || href
    out.push({ title, href })
  }
  return out
}

const parseH3Links = (html: string, max = 3): LinkItem[] => {
  const out: LinkItem[] = []
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < max) {
    const href = decodeHtml(m[1])
    if (!looksOrganic(href)) continue
    const title = stripTags(decodeHtml(m[2] || "")) || href
    out.push({ title, href })
  }
  return out
}

const parseTopLinks = (rawHtml: string, max = 3): LinkItem[] => {
  const html = inSearchSection(rawHtml)
  let links: LinkItem[] = []
  links = links.concat(parseYuRUbf(html, max - links.length))
  if (links.length < max) links = links.concat(parseBasicAnchors(html, max - links.length))
  if (links.length < max) links = links.concat(parseH3Links(html, max - links.length))
  return dedupe(links, (l) => l.href).slice(0, max)
}

const looksBlocked = (html: string) =>
  /unusual\s+traffic|not\s+a\s+robot|enable\s+javascript|consent\.google/i.test(html)

// ---------- message handler ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "eco_google_search" || typeof msg.q !== "string") return

  ;(async () => {
    try {
      // try normal desktop results first
      const u1 = new URL("https://www.google.com/search")
      u1.searchParams.set("q", msg.q)
      u1.searchParams.set("hl", "en")
      u1.searchParams.set("num", "10")
      u1.searchParams.set("pws", "0")

      const res1 = await fetch(u1.toString(), {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
        }
      })
      const html1 = await res1.text()
      let links = parseTopLinks(html1, 3)

      // fallback: basic HTML if blocked or none
      if (links.length < 3 || looksBlocked(html1)) {
        const u2 = new URL("https://www.google.com/search")
        u2.searchParams.set("q", msg.q)
        u2.searchParams.set("hl", "en")
        u2.searchParams.set("num", "10")
        u2.searchParams.set("pws", "0")
        u2.searchParams.set("gbv", "1")

        const res2 = await fetch(u2.toString(), { method: "GET", credentials: "omit", cache: "no-store" })
        const html2 = await res2.text()
        const more = parseTopLinks(html2, 3)
        links = dedupe([...links, ...more], (l) => l.href).slice(0, 3)
      }

      // debug logs (in the worker console)
      console.log("[EcoPrompt BG] query:", msg.q)
      console.log("[EcoPrompt BG] links:", links)

      sendResponse({ ok: true, links })
    } catch (e) {
      console.error("[EcoPrompt BG] error:", e)
      sendResponse({ ok: false, error: String(e) })
    }
  })()

  return true // keep the port open
})
