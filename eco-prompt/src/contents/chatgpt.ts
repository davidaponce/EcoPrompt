// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import { tokensToImpact, fmtInt, fmtKWh, fmtG } from "../lib/co2"

// Run on ChatGPT (old and new domains)
export const config: PlasmoCSConfig = {
  matches: ["*://chat.openai.com/*", "*://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_idle"
}

// ---------- styles & DOM ----------
const ensureStyle = () => {
  if (document.getElementById("eco-style-chatgpt")) return
  const style = document.createElement("style")
  style.id = "eco-style-chatgpt"
  style.textContent = `
    #eco-topright {
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: 320px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,.15); padding: 12px 14px;
      font: 13px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      #eco-topright {
        background: #16181c; color: #e5e7eb; border-color: #2a2f39;
      }
      #eco-topright .muted { color: #9aa3b2; }
    }
    #eco-topright h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
    #eco-topright .row { margin: 4px 0; }
    #eco-topright .small { font-size: 12px; opacity: .8; }
  `
  document.head.appendChild(style)
}

const ensurePanel = () => {
  let el = document.getElementById("eco-topright") as HTMLDivElement | null
  if (!el) {
    el = document.createElement("div")
    el.id = "eco-topright"
    document.body.appendChild(el)
  }
  return el
}

// ---------- input detection ----------
const isVisible = (el: Element) => {
  const r = (el as HTMLElement).getBoundingClientRect()
  const st = window.getComputedStyle(el as HTMLElement)
  return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"
}

const getPromptNode = (): HTMLTextAreaElement | HTMLElement | null => {
  const candidates: Element[] = [
    document.querySelector('textarea#prompt-textarea')!,
    document.querySelector('textarea[data-id="prompt-textarea"]')!,
    document.querySelector('[data-testid="composer:input"] [contenteditable="true"][role="textbox"]')!,
    document.querySelector('textarea[placeholder*="Message"]')!,
    ...Array.from(document.querySelectorAll("textarea")),
    ...Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'))
  ].filter(Boolean) as Element[]

  let best: Element | null = null
  let bestArea = 0
  for (const el of candidates) {
    if (!isVisible(el)) continue
    const r = (el as HTMLElement).getBoundingClientRect()
    const area = r.width * r.height
    if (area > bestArea) { best = el; bestArea = area }
  }
  return (best as HTMLTextAreaElement | HTMLElement) || null
}

const readText = (el: HTMLTextAreaElement | HTMLElement | null): string => {
  if (!el) return ""
  if ("value" in el && typeof (el as HTMLTextAreaElement).value === "string") {
    return (el as HTMLTextAreaElement).value.trim()
  }
  return (el.textContent || "").trim()
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

  const node = getPromptNode()
  const text = readText(node)
  const tokens = safeTokenize(text.replace(/\s+/g, " "))

  // expose to popup / other UIs
  chrome.storage.local.set({ currentTokens: tokens, currentSource: "chatgpt" })

  const impact = tokensToImpact(tokens)
  const el = ensurePanel()

  el.innerHTML = `
    <h3>AI Footprint</h3>
    <div class="row">Tokens: ${fmtInt(tokens)}</div>
    <div class="row">Energy: ${fmtKWh(impact.kwh)}</div>
    <div class="row">Emissions: ${fmtG(impact.gCO2)}</div>
    <div class="row small muted">
      ≈ ${fmtInt(impact.eq.phoneCharges)} phone charges ·
      ≈ ${fmtInt(impact.eq.bulbHours60W)} h (60W) ·
      ≈ ${fmtInt(impact.eq.googleSearches)} searches
    </div>
  `
}

// ---------- wire up ----------
const debouncedRender = debounce(render, 120)

const bindInput = () => {
  const node = getPromptNode()
  if (!node) return
  // textarea
  node.addEventListener("input", debouncedRender as any)
  node.addEventListener("keyup", debouncedRender as any)
  // IME support
  node.addEventListener("compositionupdate", debouncedRender as any)
  node.addEventListener("compositionend", debouncedRender as any)
}

const boot = () => {
  render()
  bindInput()
  const mo = new MutationObserver(() => {
    bindInput()
    debouncedRender()
  })
  mo.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot, { once: true })
} else {
  boot()
}