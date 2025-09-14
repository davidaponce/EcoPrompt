// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import {
  // live footprint
  tokensToImpact, fmtInt, fmtKWh, fmtG, fmtEq, fmtPhoneCharge, fmtBulbTime, setProfile,
  // savings (no water/trees)
  compareImpact
} from "../lib/co2"

// Run on ChatGPT (old + new domains)
export const config: PlasmoCSConfig = {
  matches: ["*://chat.openai.com/*", "*://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_start"
}

// Pick the impact profile (extreme/typical/conservative)
setProfile("extreme")

// ---------- styles & DOM ----------
const ensureStyle = () => {
  if (document.getElementById("eco-style-chatgpt")) return;
  const style = document.createElement("style")
  style.id = "eco-style-chatgpt"
  style.textContent = `
    #eco-topright{
      position:fixed;top:12px;right:12px;z-index:2147483647;
      width:340px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.15);padding:12px 14px;
      color:#111827;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif
    }
    @media (prefers-color-scheme: dark){
      #eco-topright{background:#16181c;color:#e5e7eb;border-color:#2a2f39}
      #eco-saved{background:#0d3b1e;color:#d2f5df;border-color:#14532d}
    }
    #eco-topright h3{margin:0 0 6px;font-size:14px;font-weight:600}
    #eco-topright .row{margin:4px 0}
    #eco-topright .small{font-size:12px;opacity:.85}
    #eco-saved{
      margin-top:8px;border:1px solid #16a34a;background:#ecfdf5;color:#065f46;
      border-radius:10px;padding:8px 10px;font-size:12px
    }
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

// ---------- grab/set editor text ----------
let currentPrompt = ""

const readDeepActive = (): HTMLElement | null => {
  const getDeep = (root: Document | ShadowRoot): Element | null => {
    // @ts-ignore
    const ae = root.activeElement as Element | null
    const sr = (ae as any)?.shadowRoot as ShadowRoot | undefined
    return sr ? getDeep(sr) : ae
  }
  return (getDeep(document) as HTMLElement | null) || null
}

const getTextFromNode = (el: Element | null): string => {
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement) return el.value || ""
  if (el instanceof HTMLElement) {
    const isCE = el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"
    if (isCE) return (el.innerText ?? el.textContent ?? "") as string
  }
  return ""
}

const setTextIntoNode = (el: Element | null, text: string) => {
  if (!el) return
  if (el instanceof HTMLTextAreaElement) {
    el.value = text
    el.dispatchEvent(new InputEvent("input", { bubbles: true }))
    return
  }
  if (el instanceof HTMLElement) {
    const isCE = el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"
    if (isCE) {
      el.innerText = text
      el.dispatchEvent(new InputEvent("input", { bubbles: true }))
    }
  }
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
  catch { return Math.ceil((text || "").length / 4) }
}

// ---------- trimmer ----------
const TRIM_WORDS = [
  "thank you", "thanks", "please", "kindly", "wait",
  "might", "maybe", "perhaps", "just", "sort of", "kinda", "like",
  "i would like to", "if you can", "could you", "would you",
  "really", "actually", "basically", "in detail", "very detailed"
]
const trimPrompt = (s: string): string => {
  if (!s) return ""
  let t = s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
  // drop quotes
  t = t.replace(/["']/g, " ")
  // remove phrases
  for (const w of TRIM_WORDS) {
    const re = new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "gi")
    t = t.replace(re, " ")
  }
  // tidy
  t = t.replace(/[!?.,;:]{2,}/g, m => m[0]).replace(/\s{2,}/g, " ").trim()
  return t || s.trim()
}

// ---------- live panel ----------
const render = () => {
  ensureStyle()
  const el = ensurePanel()

  const active = readDeepActive()
  const raw = (currentPrompt || getTextFromNode(active) || "").replace(/\s+/g, " ").trim()
  const typedTokens = safeTokenize(raw)
  const impact = tokensToImpact(typedTokens)

  chrome.storage?.local?.set?.({ currentTokens: typedTokens, currentSource: "chatgpt" })

  const savedDiv = document.getElementById("eco-saved")
  const savedHTML = savedDiv ? savedDiv.outerHTML : ""

  el.innerHTML = `
    <h3>EcoPrompt <span aria-hidden="true">&#x1F331;</span></h3>
    <div class="row">Input tokens: ${fmtInt(typedTokens)}</div>
    <div class="row">Tokens (incl. output est.): ${fmtInt(impact.tokens)}</div>
    <div class="row">Energy: ${fmtKWh(impact.kwh)}</div>
    <div class="row">Emissions: ${fmtG(impact.gCO2)}</div>
    <div class="row small">
      ≈ ${fmtPhoneCharge(impact.eq.phoneCharges)} phone charge ·
      ≈ ${fmtBulbTime(impact.eq.bulbHours60W)} (60W) ·
      ≈ ${fmtEq(impact.eq.googleSearches)} searches
    </div>
    ${savedHTML}
  `
}

// keep “stopped typing” snapshot for savings math
let baselineText = ""
let baselineTokens = 0
const markStoppedTyping = debounce(() => {
  const active = readDeepActive()
  baselineText = getTextFromNode(active)
  baselineTokens = safeTokenize((baselineText || "").replace(/\s+/g, " ").trim())
}, 600)

const debouncedRender = debounce(render, 150)

// ---------- savings on send ----------
const isSendButton = (n: Element | null): boolean => {
  if (!n) return false
  const el = n as HTMLElement
  return !!(
    el.closest('button[data-testid="send-button"]') ||
    el.closest('button[aria-label^="Send"]') ||
    el.closest('[data-testid="composer:button-send"]')
  )
}

const showSavedToast = (html: string) => {
  const panel = ensurePanel()
  let toast = document.getElementById("eco-saved")
  if (!toast) {
    toast = document.createElement("div")
    toast.id = "eco-saved"
    panel.appendChild(toast)
  }
  toast.innerHTML = html
  // keep or remove auto-hide as you prefer:
  window.setTimeout(() => { toast?.remove() }, 5000)
}

const recordCumulative = async (tokensSaved: number, gSaved: number) => {
  const { ecoStats } = await chrome.storage.local.get("ecoStats")
  const v = (ecoStats && typeof ecoStats === "object")
    ? ecoStats
    : { tokens_saved: 0, co2_saved_g: 0, queries_rewritten: 0 }
  v.tokens_saved = (v.tokens_saved || 0) + Math.round(tokensSaved)
  v.co2_saved_g = (v.co2_saved_g || 0) + gSaved
  v.queries_rewritten = (v.queries_rewritten || 0) + 1
  await chrome.storage.local.set({ ecoStats: v })
}

const postToBackend = async (_payload: any) => {
  // Optional: requires host_permissions for your API in manifest.
  // try { await fetch("https://api.yourdomain.com/v1/saves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) } catch {}
}

const onSend = (_triggerEl: Element | null) => {
  // 1) before
  const active = readDeepActive()
  const beforeText = (baselineText || currentPrompt || getTextFromNode(active) || "").trim()
  const beforeTokens = safeTokenize(beforeText)

  // 2) trim
  const afterText = trimPrompt(beforeText)
  const afterTokens = safeTokenize(afterText)

  // 3) inject if changed
  if (afterText !== beforeText) {
    setTextIntoNode(active, afterText)
  }

  // 4) savings (input + estimated output)
  const delta = compareImpact(beforeTokens, afterTokens)

  // 5) toast (NO water/trees)
  showSavedToast(
    `Saved <b>${fmtInt(delta.tokensSaved)}</b> tokens, <b>${fmtKWh(delta.kwhSaved)}</b>, <b>${fmtG(delta.gSaved)}</b><br/>
     ≈ ${fmtEq(delta.eq.googleSearches)} searches ·
     ≈ ${fmtPhoneCharge(delta.eq.phoneCharges)} of a phone charge`
  )

  // 6) record + optional backend
  recordCumulative(delta.tokensSaved, delta.gSaved)
  postToBackend({
    ts: Date.now(),
    source: "chatgpt",
    beforeTokens, afterTokens,
    saved: {
      tokens: delta.tokensSaved,
      kwh: delta.kwhSaved,
      gCO2: delta.gSaved,
      searches: delta.eq.googleSearches,
      phoneCharges: delta.eq.phoneCharges
    }
  })

  debouncedRender()
}

// Click send (capture)
document.addEventListener("click", (ev) => {
  const t = ev.target as Element | null
  if (isSendButton(t)) onSend(t)
}, true)

// Enter to send (capture)
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) onSend(document.activeElement as Element | null)
}, true)

// ---------- boot & listeners ----------
const main = () => {
  render()

  const updateFromEvent = (ev: Event) => {
    const path = (ev.composedPath && ev.composedPath()) || []
    for (const p of path) {
      if (p && p instanceof HTMLElement) {
        const role = p.getAttribute("role")
        const ce = p.getAttribute("contenteditable")
        if (p.tagName === "TEXTAREA" || ce === "true" || role === "textbox") {
          currentPrompt = getTextFromNode(p)
          markStoppedTyping()
          break
        }
      }
    }
    debouncedRender()
  }
  document.addEventListener("input", updateFromEvent, true)
  document.addEventListener("keyup", updateFromEvent, true)
  document.addEventListener("paste", updateFromEvent, true)
  document.addEventListener("compositionend", updateFromEvent, true)

  const mo = new MutationObserver(debouncedRender)
  mo.observe(document.documentElement, { childList: true, subtree: true })

  setInterval(debouncedRender, 1200)
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", main, { once: true })
} else {
  main()
}