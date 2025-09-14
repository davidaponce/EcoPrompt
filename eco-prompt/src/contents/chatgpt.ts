// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import {
  tokensToImpact,
  fmtInt, fmtKWh, fmtG, fmtEq,
  fmtPhoneCharge, fmtBulbTime,
  setProfile
} from "../lib/co2"

// Run on ChatGPT (old + new domains)
export const config: PlasmoCSConfig = {
  matches: ["*://chat.openai.com/*", "*://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_start"
}

// Pick the impact profile you want (honest but more/less “extreme”)
setProfile("extreme") // or "typical" / "conservative"

// ---------- styles & DOM ----------
const ensureStyle = () => {
  if (document.getElementById("eco-style-chatgpt")) return
  const style = document.createElement("style")
  style.id = "eco-style-chatgpt"
  style.textContent = `
    #eco-topright{
      position:fixed;top:12px;right:12px;z-index:2147483647;
      width:320px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.15);padding:12px 14px;
      color:#111827;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif
    }
    @media (prefers-color-scheme: dark){
      #eco-topright{background:#16181c;color:#e5e7eb;border-color:#2a2f39}
    }
    #eco-topright h3{margin:0 0 6px;font-size:14px;font-weight:600}
    #eco-topright .row{margin:4px 0}
    #eco-topright .small{font-size:12px;opacity:.85}
  `
  document.head.appendChild(style)
}

const ensurePanel = (): HTMLDivElement => {
  let el = document.getElementById("eco-topright") as HTMLDivElement | null
  if (!el) {
    el = document.createElement("div")
    el.id = "eco-topright"
    document.body.appendChild(el)
  }
  return el
}

// ---------- grab text robustly ----------
let currentPrompt = ""

// Read deepest active element (handles shadow DOM)
const readDeepActive = (): string => {
  const getDeep = (root: Document | ShadowRoot): Element | null => {
    // @ts-ignore
    const ae = root.activeElement as Element | null
    const sr = (ae as any)?.shadowRoot as ShadowRoot | undefined
    return sr ? getDeep(sr) : ae
  }
  const el = getDeep(document)
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement) return el.value || ""
  if (el instanceof HTMLElement) {
    const isCE = el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"
    if (isCE) return (el.innerText ?? el.textContent ?? "") as string
  }
  return ""
}

// Event target from composedPath to catch ChatGPT editor
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

const extractTextFromNode = (el: Element | null): string => {
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement) return el.value || ""
  if (el instanceof HTMLElement) {
    const isCE = el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"
    if (isCE) return (el.innerText ?? el.textContent ?? "") as string
  }
  return ""
}

// ---------- utils ----------
const debounce = <F extends (...a: any[]) => void>(fn: F, ms = 120) => {
  let t: number | undefined
  return (...args: Parameters<F>) => {
    if (t) window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }
}

const safeTokenize = (text: string): number => {
  try { return text ? encode(text).length : 0 }
  catch { return Math.ceil((text || "").length / 4) } // fallback: ~4 chars ≈ 1 token
}

// ---------- render ----------
const render = () => {
  ensureStyle()
  const el = ensurePanel()

  // Prefer event-fed prompt; fall back to deep active element
  const raw = (currentPrompt || readDeepActive() || "").replace(/\s+/g, " ").trim()
  const tokens = safeTokenize(raw)

  // Calculate impact (includes estimated output; profile affects scale)
  const impact = tokensToImpact(tokens)

  // (optional) expose to popup or other UIs
  chrome.storage?.local?.set?.({ currentTokens: tokens, currentSource: "chatgpt" })

  el.innerHTML = `
    <h3>EcoPrompt <span class="eco-emoji" aria-hidden="true">&#x1F331;</span></h3>
    <div class="row">Tokens (incl. output est.): ${fmtInt(impact.tokens)}</div>
    <div class="row">Energy: ${fmtKWh(impact.kwh)}</div>
    <div class="row">Emissions: ${fmtG(impact.gCO2)}</div>
    <div class="row small">
      ≈ ${fmtPhoneCharge(impact.eq.phoneCharges)} phone charge ·
      ≈ ${fmtBulbTime(impact.eq.bulbHours60W)} (60W) ·
      ≈ ${fmtEq(impact.eq.googleSearches)} searches
    </div>
  `
}

const debouncedRender = debounce(render, 150)

// ---------- boot & listeners ----------
const main = () => {
  render()

  // Update from any typing/paste/IME in the page (capture=true to see inside components)
  const updateFromEvent = (ev: Event) => {
    const el = targetFromEventPath(ev) || (document.activeElement as HTMLElement | null)
    currentPrompt = extractTextFromNode(el)
    debouncedRender()
  }
  document.addEventListener("input", updateFromEvent, true)
  document.addEventListener("keyup", updateFromEvent, true)
  document.addEventListener("paste", updateFromEvent, true)
  document.addEventListener("compositionend", updateFromEvent, true)

  // React to SPA mutations (ChatGPT swaps editors)
  const mo = new MutationObserver(debouncedRender)
  mo.observe(document.documentElement, { childList: true, subtree: true })

  // Safety poll in case events/mutations are missed
  setInterval(debouncedRender, 1200)
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", main, { once: true })
} else {
  main()
}