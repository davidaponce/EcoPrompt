// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import {
  tokensToImpact,
  fmtInt, fmtKWh, fmtG, fmtEq,
  fmtPhoneCharge, fmtBulbTime,
  setProfile
} from "../lib/co2"

// Optional filler list (one per line; lines starting with # are comments)
import FILLERS_RAW from "bundle-text:../data/fillers.txt"

// Run on ChatGPT (old + new domains)
export const config: PlasmoCSConfig = {
  matches: ["*://chat.openai.com/*", "*://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_start"
}

// Choose impact profile
setProfile("extreme") // or "typical" / "conservative"

// ---------- styles & panel ----------
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
    #eco-topright .actions{margin-top:8px}
    #eco-topright .btn{
      appearance:none;border:1px solid #e5e7eb;background:#f7f8fa;border-radius:8px;
      padding:6px 10px;font-size:12px;cursor:pointer
    }
    #eco-topright .btn:hover{background:#eef1f7}
    @media (prefers-color-scheme: dark){
      #eco-topright .btn{background:#1c212b;border-color:#2a2f39;color:#e5e7eb}
      #eco-topright .btn:hover{background:#232938}
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

// ---------- filler helpers ----------
const parseFillers = (raw: string) =>
  raw.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"))

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const FILLERS = parseFillers(FILLERS_RAW || "")

function stripFillers(s: string) {
  if (!s) return s
  let t = ` ${s} `
  // replace longer phrases first
  for (const p of [...FILLERS].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`\\b${esc(p)}\\b`, "gi"), " ")
  }
  return t.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim()
}

// ---------- editor detection (cache + scan) ----------
type EditorEl = HTMLTextAreaElement | HTMLInputElement | HTMLElement
let lastEditor: EditorEl | null = null

const isEditorEl = (el: Element | null): el is EditorEl => {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement && (el.type === "text" || el.type === "search")) return true
  if (el instanceof HTMLElement) {
    const ce = el.getAttribute("contenteditable") === "true"
    const role = el.getAttribute("role") === "textbox"
    return ce || role
  }
  return false
}

const isVisible = (el: Element) => {
  const h = el as HTMLElement
  const r = h.getBoundingClientRect()
  const st = getComputedStyle(h)
  return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"
}

// scan DOM for the best candidate (bottom-most, visible)
function findBestEditor(): EditorEl | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'textarea, input[type="text"], input[type="search"], [contenteditable="true"], [role="textbox"]'
    )
  )
  let best: HTMLElement | null = null
  let bestScore = -Infinity
  for (const c of candidates) {
    if (!isVisible(c)) continue
    const r = c.getBoundingClientRect()
    const score = r.width * r.height - Math.abs(window.innerHeight - r.bottom)
    if (score > bestScore) { best = c; bestScore = score }
  }
  return best as EditorEl | null
}

// Use cached editor if still in the document; else scan
function getEditor(): EditorEl | null {
  if (lastEditor && document.contains(lastEditor)) return lastEditor
  lastEditor = findBestEditor()
  return lastEditor
}

function getEditorText(): string {
  const el = getEditor()
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
  return (el.innerText ?? el.textContent ?? "") as string
}

function setEditorText(text: string) {
  const el = getEditor()
  if (!el) return

  // Case 1: <textarea>/<input>
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = Object.getPrototypeOf(el)
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    setter ? setter.call(el, text) : (el.value = text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    return
  }

  // Case 2: contenteditable (Lexical/React)
  el.focus()
  // Select-all inside the editor so we can replace safely even if focus moved to the button
  const sel = document.getSelection()
  sel?.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(el)
  sel?.addRange(range)

  // Preferred path: insertText (fires beforeinput+input that editors listen to)
  document.execCommand("insertText", false, text)

  // Extra nudge for some builds
  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertReplacementText",
    data: text
  }))
}

// ---------- capture user typing (keeps cache fresh) ----------
let currentPrompt = ""

const targetFromEventPath = (ev: Event): HTMLElement | null => {
  const path = (ev.composedPath && ev.composedPath()) || []
  for (const t of path) {
    if (t && t instanceof HTMLElement) {
      if (isEditorEl(t)) return t
    }
  }
  return null
}

const extractTextFromNode = (el: Element | null): string => {
  if (!isEditorEl(el)) return ""
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value || ""
  return (el.innerText ?? el.textContent ?? "") as string
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

// Guarded chrome.storage write (avoid dev “context invalidated” crashes)
const canUseChrome = () =>
  typeof chrome !== "undefined" &&
  !!chrome.runtime &&
  !!chrome.runtime.id &&
  !!chrome.storage?.local

const safeStore = (data: Record<string, unknown>) => {
  try { if (canUseChrome()) chrome.storage.local.set(data) } catch { /* noop */ }
}

// ---------- render ----------
const render = () => {
  ensureStyle()
  const panel = ensurePanel()

  // Prefer event-fed prompt; fallback to editor text
  const raw = (currentPrompt || getEditorText() || "").replace(/\s+/g, " ").trim()
  const tokens = safeTokenize(raw)
  const impact = tokensToImpact(tokens)

  safeStore({ currentTokens: tokens, currentSource: "chatgpt" })

  panel.innerHTML = `
    <h3>EcoPrompt <span aria-hidden="true">&#x1F331;</span></h3>
    <div class="row">Tokens (incl. output est.): ${fmtInt(impact.tokens)}</div>
    <div class="row">Energy: ${fmtKWh(impact.kwh)}</div>
    <div class="row">Emissions: ${fmtG(impact.gCO2)}</div>
    <div class="row small">
      ≈ ${fmtPhoneCharge(impact.eq.phoneCharges)} phone charge ·
      ≈ ${fmtBulbTime(impact.eq.bulbHours60W)} (60W) ·
      ≈ ${fmtEq(impact.eq.googleSearches)} searches
    </div>
    <div class="actions">
      <button id="eco-trim" class="btn" title="Remove filler words from your prompt">Trim filler</button>
    </div>
  `

  const btn = panel.querySelector<HTMLButtonElement>("#eco-trim")
  if (btn) {
    btn.onclick = () => {
      // Use cached/scanned editor, not activeElement (button has focus)
      const before = getEditorText()
      const after  = stripFillers(before)
      if (after !== before) {
        setEditorText(after)
        currentPrompt = after
      }
    }
  }
}

const debouncedRender = debounce(render, 150)

// ---------- boot & listeners ----------
const main = () => {
  render()

  // Keep cache fresh and panel updated
  const updateFromEvent = (ev: Event) => {
    const el = targetFromEventPath(ev) || (document.activeElement as Element | null)
    if (isEditorEl(el)) lastEditor = el as EditorEl
    currentPrompt = extractTextFromNode(el)
    debouncedRender()
  }
  document.addEventListener("input", updateFromEvent, true)
  document.addEventListener("keyup", updateFromEvent, true)
  document.addEventListener("paste", updateFromEvent, true)
  document.addEventListener("compositionend", updateFromEvent, true)

  // React to SPA mutations or view changes
  const mo = new MutationObserver(debouncedRender)
  mo.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("resize", debouncedRender)
  window.addEventListener("scroll", debouncedRender, true)

  // Safety poll
  setInterval(debouncedRender, 1200)
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", main, { once: true })
} else {
  main()
}
