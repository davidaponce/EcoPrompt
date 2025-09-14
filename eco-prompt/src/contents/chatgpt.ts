// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import {
  // live footprint
  tokensToImpact,
  fmtInt, fmtKWh, fmtG, fmtEq, fmtPhoneCharge, fmtBulbTime,
  setProfile,
  // savings
  compareImpact, fmtLiters, fmtTreeDays
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
  if (document.getElementById("eco-style-chatgpt")) return
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

    /* Saved (green) toast */
    #eco-saved{
      margin-top:8px;border:1px solid #16a34a;background:#ecfdf5;color:#065f46;
      border-radius:10px;padding:8px 10px;font-size:12px
    }

    /* Simple action button */
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

// ---------- grab/set editor text ----------
let currentPrompt = ""

// Deep-active element (through shadow roots)
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

// ---------- BASIC TRIMMER ----------
const trimPromptBasic = (s: string): string => {
  return s
    .replace(/\s+/g, " ")
    .replace(/\b(please|kindly|if you can|could you|I would like to|just)\b/gi, "")
    .replace(/\b(in detail|very detailed|extremely|really|basically|actually)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

/* ------------------------------------------------------------------ */
/*                    TRIM BUTTON: editor-safe plumbing                */
/*  Works even when the button steals focus (scans/caches the editor)  */
/* ------------------------------------------------------------------ */

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
// bottom-most visible editor wins
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
  // Case 2: contenteditable (React/Lexical)
  el.focus()
  const sel = document.getSelection()
  sel?.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(el)
  sel?.addRange(range)
  document.execCommand("insertText", false, text)
  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertReplacementText",
    data: text
  }))
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
    <div class="actions">
      <button id="eco-trim" class="btn" title="Remove filler words from your prompt">Trim filler</button>
    </div>
  `

  // Trim button behavior (uses cached/scanned editor so focus on button is OK)
  const btn = el.querySelector<HTMLButtonElement>("#eco-trim")
  if (btn) {
    btn.onclick = () => {
      const before = getEditorText()
      const after  = trimPromptBasic(before)
      if (after !== before) {
        setEditorText(after)
        currentPrompt = after
      }
    }
  }
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
  // auto-hide after 5s
  window.setTimeout(() => { toast?.remove() }, 5000)
}

const recordCumulative = async (tokensSaved: number, gSaved: number) => {
  const { ecoStats } = await chrome.storage.local.get("ecoStats")
  const v = (ecoStats && typeof ecoStats === "object") ? ecoStats : { tokens_saved: 0, co2_saved_g: 0, queries_rewritten: 0 }
  v.tokens_saved = (v.tokens_saved || 0) + Math.round(tokensSaved)
  v.co2_saved_g = (v.co2_saved_g || 0) + gSaved
  v.queries_rewritten = (v.queries_rewritten || 0) + 1
  await chrome.storage.local.set({ ecoStats: v })
}

const postToBackend = async (_payload: any) => {
  // Optional: requires host_permissions for your API in manifest.
  // try {
  //   await fetch("https://api.yourdomain.com/v1/saves", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(payload)
  //   })
  // } catch {}
}

const onSend = (_triggerEl: Element | null) => {
  // 1) collect before text/tokens
  const beforeText = (baselineText || currentPrompt || getEditorText() || "").trim()
  const beforeTokens = safeTokenize(beforeText)

  // 2) trim (same logic the button uses)
  const afterText = trimPromptBasic(beforeText)
  const afterTokens = safeTokenize(afterText)

  // 3) if changed, inject trimmed text before ChatGPT consumes it
  if (afterText !== beforeText) {
    setEditorText(afterText)
  }

  // 4) compute savings (input + estimated output)
  const delta = compareImpact(beforeTokens, afterTokens)

  // 5) toast in panel
  showSavedToast(
    `Saved <b>${fmtInt(delta.tokensSaved)}</b> tokens, <b>${fmtKWh(delta.kwhSaved)}</b>, <b>${fmtG(delta.gSaved)}</b><br/>
     ≈ ${fmtEq(delta.eq.googleSearches)} searches ·
     ≈ ${fmtPhoneCharge(delta.eq.phoneCharges)} of a phone charge ·
     ≈ ${fmtLiters(delta.eq.waterLiters)} water ·
     ≈ ${fmtTreeDays(delta.eq.treeDays)}`
  )

  // 6) increment local totals and optionally send to backend
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
      phoneCharges: delta.eq.phoneCharges,
      waterLiters: delta.eq.waterLiters,
      treeDays: delta.eq.treeDays
    }
  })

  debouncedRender()
}

// Click send (capture)
document.addEventListener("click", (ev) => {
  const t = ev.target as Element | null
  if (isSendButton(t)) onSend(t)
}, true)

// Enter to send (capture) — don’t block default, just observe
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey && isEditorEl(document.activeElement as Element | null)) {
    onSend(document.activeElement as Element | null)
  }
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
          lastEditor = p as EditorEl // keep cache fresh for the Trim button
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

  // keep underline/panel aligned on viewport changes (safe)
  window.addEventListener("resize", debouncedRender)
  window.addEventListener("scroll", debouncedRender, true)

  setInterval(debouncedRender, 1200)
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", main, { once: true })
} else {
  main()
}
