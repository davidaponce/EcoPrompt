// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import { tokensToImpact, fmtInt, fmtKWh, fmtG } from "../lib/co2"

export const config: PlasmoCSConfig = {
  matches: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_idle"
}

type LinkItem = { title: string; href: string }

const GRAMS_PER_TOKEN = 0.0002
const AVG_COMPLETION_TOKENS = 400

// ---------------- UI ----------------
const ensureStyle = () => {
  if (document.getElementById("eco-style-chatgpt")) return
  const style = document.createElement("style")
  style.id = "eco-style-chatgpt"
  style.textContent = `
    #eco-topright{position:fixed;top:12px;right:12px;z-index:2147483647;width:350px;background:#fff;border:1px solid #dadce0;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.15);padding:10px 12px;font:13px/1.45 Arial,sans-serif; color:#111}
    #eco-topright .eco-status{font-size:12px;color:#5f6368;padding:6px 0}
    #eco-topright .eco-list{margin:0;padding:0;list-style:none}
    #eco-topright .eco-item{margin:0;padding:8px 0;border-top:1px solid #eee}
    #eco-topright .eco-item:first-child{border-top:none}
    #eco-topright .eco-link{text-decoration:none;display:block}
    #eco-topright .eco-link:hover .eco-title{text-decoration:underline}
    #eco-topright .eco-title{font-size:13px;font-weight:600;color:#1a0dab;overflow-wrap:anywhere}
    #eco-topright .eco-url{font-size:12px;color:#006621}
    #eco-topright .eco-footprint h3{margin:0 0 6px;font-size:14px;font-weight:600}
    #eco-topright .eco-row{margin:4px 0}
    #eco-topright .eco-small{font-size:12px;opacity:.8}
  `
  ;(document.head || document.documentElement).appendChild(style)
}
const ensurePopup = () => {
  let el = document.getElementById("eco-topright") as HTMLDivElement | null
  if (!el) { el = document.createElement("div"); el.id = "eco-topright"; (document.body || document.documentElement).appendChild(el) }
  return el
}
const showStatus = (msg: string) => {
  ensureStyle()
  ensurePopup().innerHTML = `<div class="eco-status">EcoPrompt: ${msg}</div>`
}
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]!))
const escapeAttr = (s: string) => s.replace(/"/g, "&quot;")
const simplifyURL = (url: string) => { try { const u=new URL(url); return u.hostname.replace(/^www\./,"")+u.pathname.replace(/\/$/,"") } catch { return url } }

// ---------------- Stats on click ----------------
type EcoStatsV2 = {
  total_tokens_saved:number; total_co2_saved_g:number;
  rewrites_tokens_saved:number; clicks_tokens_saved:number;
  rewrites_count:number; result_clicks_count:number;
  tokens_saved:number; co2_saved_g:number; queries_rewritten:number
}
const migrateToV2 = (raw:any):EcoStatsV2 => {
  const v=(raw&&typeof raw==="object"?raw:{}) as Partial<EcoStatsV2>
  const rew=v.rewrites_tokens_saved ?? v.tokens_saved ?? 0
  const clk=v.clicks_tokens_saved ?? 0
  const total=(rew||0)+(clk||0)
  const co2=total*GRAMS_PER_TOKEN
  return { total_tokens_saved:total, total_co2_saved_g:co2, rewrites_tokens_saved:rew||0, clicks_tokens_saved:clk||0,
    rewrites_count:v.rewrites_count ?? v.queries_rewritten ?? 0, result_clicks_count:v.result_clicks_count ?? 0,
    tokens_saved:total, co2_saved_g:co2, queries_rewritten:(v.rewrites_count ?? 0)+(v.result_clicks_count ?? 0) }
}
const incrementClickStats = async (prompt:string) => {
  const avoided=encode(prompt).length
  const saved=avoided+AVG_COMPLETION_TOKENS
  const { ecoStats }=await chrome.storage.local.get("ecoStats")
  const v2=migrateToV2(ecoStats)
  v2.clicks_tokens_saved+=saved
  v2.result_clicks_count+=1
  v2.total_tokens_saved=v2.rewrites_tokens_saved+v2.clicks_tokens_saved
  v2.total_co2_saved_g=v2.total_tokens_saved*GRAMS_PER_TOKEN
  v2.tokens_saved=v2.total_tokens_saved
  v2.co2_saved_g=v2.total_co2_saved_g
  v2.queries_rewritten=v2.rewrites_count+v2.result_clicks_count
  await chrome.storage.local.set({ ecoStats: v2 })
}

// ---------------- Google via background ----------------
const searchGoogle = (q: string): Promise<LinkItem[] | { error: string }> =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "eco_google_search", q }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ error: chrome.runtime.lastError.message })
      if (!resp?.ok || !Array.isArray(resp.links)) return resolve({ error: String(resp?.error || "No links") })
      resolve(resp.links as LinkItem[])
    })
  })

// ---------------- Prompt capture (works through shadow DOM) ----------------
let currentPrompt = "" // updated by event listeners
let lastTokens = -1     // for cheap change detection

const extractTextFromNode = (el: Element | Document | null): string => {
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement) return el.value || ""
  if (el instanceof HTMLElement) {
    const ce = el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"
    if (ce) {
      // @ts-ignore
      const text = (el.innerText ?? el.textContent ?? "") as string
      return (text || "").trim()
    }
  }
  return ""
}
const targetFromEventPath = (ev: Event): HTMLElement | null => {
  const path = (ev.composedPath && ev.composedPath()) || []
  for (const t of path) {
    if (t && t instanceof HTMLElement) {
      const tag = t.tagName
      const role = t.getAttribute("role")
      const ce = t.getAttribute("contenteditable")
      if (tag === "TEXTAREA" || ce === "true" || role === "textbox") return t
    }
  }
  return null
}
const readDeepActive = (): string => {
  const getDeep = (root: Document | ShadowRoot): Element | null => {
    // @ts-ignore
    const ae: Element | null = root.activeElement || null
    const sr = (ae as any)?.shadowRoot as ShadowRoot | undefined
    return sr ? getDeep(sr) : ae
  }
  const el = getDeep(document) as Element | null
  return extractTextFromNode(el)
}

const safeTokenize = (text: string): number => {
  try { return text ? encode(text).length : 0 }
  catch { return Math.ceil((text || "").length / 4) }
}

// ---------------- Render ----------------
const debounce = <T extends (...a:any[])=>void>(fn:T, ms:number) => {
  let t:number|undefined
  return (...a:Parameters<T>) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms) }
}

let lastQuery = ""
let lastLinks: LinkItem[] = []

const render = async () => {
  ensureStyle()

  // Prefer event-fed prompt; fall back to deep active element
  const q0 = currentPrompt || readDeepActive()
  const q = (q0 || "").replace(/\s+/g, " ").trim()

  // ---- NEW: live tokens + CO₂ panel ----
  const tokens = safeTokenize(q)
  if (tokens !== lastTokens) {
    lastTokens = tokens
    chrome.storage.local.set({ currentTokens: tokens, currentSource: "chatgpt" })
  }
  const impact = tokensToImpact(tokens)

  // ---- Google results (existing behavior) ----
  if (q && q !== lastQuery) {
    lastQuery = q
    showStatus("Searching Google…")
    const resp = await searchGoogle(q)
    if (Array.isArray(resp)) lastLinks = resp
    else { lastLinks=[]; showStatus(`Could not fetch Google: ${resp.error}`) }
  }

  const el = ensurePopup()
  const linksHTML = lastLinks.length
    ? `
      <ul class="eco-list">
        ${lastLinks.slice(0,3).map((l,i)=>`
          <li class="eco-item">
            <a class="eco-link" data-eco-index="${i}" href="${escapeAttr(l.href)}" target="_blank" rel="noopener">
              <div class="eco-title">${escapeHtml(l.title || l.href)}</div>
              <div class="eco-url">${escapeHtml(simplifyURL(l.href))}</div>
            </a>
          </li>`).join("")}
      </ul>`
    : (q ? `<div class="eco-status">No results found.</div>` : ``)

  // ---- Compose card: CO₂ first, then links ----
  el.innerHTML = `
    <div class="eco-footprint">
      <h3>AI Footprint</h3>
      <div class="eco-row">Tokens: ${fmtInt(tokens)}</div>
      <div class="eco-row">Energy: ${fmtKWh(impact.kwh)}</div>
      <div class="eco-row">Emissions: ${fmtG(impact.gCO2)}</div>
      <div class="eco-row eco-small">
        ≈ ${fmtInt(impact.eq.phoneCharges)} phone charges ·
        ≈ ${fmtInt(impact.eq.bulbHours60W)} h (60W) ·
        ≈ ${fmtInt(impact.eq.googleSearches)} searches
      </div>
    </div>
    ${linksHTML}
  `

  // click tracking stays the same
  el.querySelectorAll<HTMLAnchorElement>("a[data-eco-index]").forEach(a => {
    a.onclick = () => incrementClickStats(q)
  })
}

const debouncedRender = debounce(render, 200)

const main = () => {
  render()

  // Listen anywhere & update currentPrompt
  const updateFromEvent = (ev: Event) => {
    const el = targetFromEventPath(ev) || (document.activeElement as HTMLElement | null)
    const txt = extractTextFromNode(el || null)
    if (txt !== undefined) currentPrompt = txt
    debouncedRender()
  }
  document.addEventListener("input", updateFromEvent, true)
  document.addEventListener("keyup", updateFromEvent, true)
  document.addEventListener("paste", updateFromEvent, true)
  document.addEventListener("compositionend", updateFromEvent, true)

  // Watch SPA/DOM changes
  const mo = new MutationObserver(debouncedRender)
  mo.observe(document.documentElement, { childList:true, subtree:true })

  // Safety poll
  setInterval(debouncedRender, 1200)
}

if (document.readyState === "complete" || document.readyState === "interactive") main()
else window.addEventListener("DOMContentLoaded", main, { once:true })