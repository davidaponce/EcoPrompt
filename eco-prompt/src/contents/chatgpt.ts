// src/contents/chatgpt.ts
import type { PlasmoCSConfig } from "plasmo"
import { encode } from "gpt-tokenizer"
import {
  tokensToImpact,
  fmtInt, fmtKWh, fmtG, fmtEq,
  fmtPhoneCharge, fmtBulbTime,
  setProfile
} from "../lib/co2"

import FILLERS_RAW from "bundle-text:../data/fillers.txt"

// ---------- Supabase REST config ----------
const SUPABASE_URL = "https://xzuzepthtnckpspdlaap.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXplcHRodG5ja3BzcGRsYWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MDI3MjgsImV4cCI6MjA3MzM3ODcyOH0.TKTnYGi8SxzpgHsYShha4LHwvTxEVF6Y3Wbit4gIA1w"
const TEMP_USER_ID = "ffd21808-54a7-4c3b-becb-6436341ed95f"
const PROFILE_KEY: "user_id" | "id" = "user_id"

const tryRpcIncrement = async (delta: number) => {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_tokens_saved`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_user_id: TEMP_USER_ID, p_delta: Math.round(delta) })
  })
  return resp.ok
}

const fallbackIncrement = async (delta: number) => {
  const q = encodeURIComponent(TEMP_USER_ID)
  const r1 = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?${PROFILE_KEY}=eq.${q}&select=total_tokens_saved`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  )
  if (!r1.ok) return
  const rows = await r1.json()
  const current = Number(rows?.[0]?.total_tokens_saved ?? 0)
  const next = current + Math.round(delta)

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?${PROFILE_KEY}=eq.${q}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ total_tokens_saved: next })
  })
}

const addSavedTokensToProfile = async (delta: number) => {
  if (delta <= 0) return
  try {
    const ok = await tryRpcIncrement(delta)
    if (!ok) await fallbackIncrement(delta)
  } catch {}
}

// ---------- Content script config ----------
export const config: PlasmoCSConfig = {
  matches: ["*://chat.openai.com/*", "*://chatgpt.com/*"],
  all_frames: false,
  run_at: "document_start"
}

setProfile("extreme")

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
    #eco-topright .url{display:block; max-width:100%; word-break:break-all; overflow-wrap:anywhere}
    #eco-topright .tiny{font-size:11px;opacity:.8;word-break:break-all;overflow-wrap:anywhere}
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

    /* Saved (green) toast */
    #eco-saved{
      margin-top:8px;border:1px solid #16a34a;background:#ecfdf5;color:#065f46;
      border-radius:10px;padding:8px 10px;font-size:12px
    }
    @media (prefers-color-scheme: dark){
      #eco-saved{background:#0d3b1e;color:#d2f5df;border-color:#14532d}
    }

    /* Google section at bottom */
    #eco-topright .google{margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:8px}
    @media (prefers-color-scheme: dark){
      #eco-topright .google{border-color:#2a2f39}
    }
    #eco-topright .link{text-decoration:none}
    #eco-topright .link:hover{text-decoration:underline}
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

// ---------- “first Google link” helpers ----------
const luckyUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(q)}&btnI=1&hl=en&safe=active`

let lastLuckyQuery = ""
let resolvedLuckyUrl: string | null = null
let resolvedLuckyTitle: string | null = null

const resolveLuckyInBg = (q: string) => {
  const url = luckyUrl(q)
  try {
    chrome.runtime?.sendMessage(
      { type: "resolve-lucky", url },
      (resp?: { ok?: boolean; url?: string; title?: string }) => {
        if (resp?.ok && resp.url) {
          resolvedLuckyUrl = resp.url
          resolvedLuckyTitle = resp.title ?? null
        } else {
          resolvedLuckyUrl = null
          resolvedLuckyTitle = null
        }
        debouncedRender()
      }
    )
  } catch { /* ignore */ }
}

// ---------- filler helpers ----------
const parseFillers = (raw: string) =>
  raw.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"))

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const FILLERS = parseFillers(FILLERS_RAW || "")

function stripFillers(s: string) {
  if (!s) return s
  let t = ` ${s} `
  for (const p of [...FILLERS].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`\\b${esc(p)}\\b`, "gi"), " ")
  }
  return t.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim()
}

// ---------- editor detection ----------
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
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = Object.getPrototypeOf(el)
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    setter ? setter.call(el, text) : (el.value = text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    return
  }
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

// ---------- capture user typing ----------
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

const canUseChrome = () =>
  typeof chrome !== "undefined" &&
  !!chrome.runtime &&
  !!chrome.runtime.id &&
  !!chrome.storage?.local

const safeStore = (data: Record<string, unknown>) => {
  try { if (canUseChrome()) chrome.storage.local.set(data) } catch {}
}

// ---------- green saved box ----------
const showSavedToast = (html: string) => {
  const panel = ensurePanel()
  let toast = document.getElementById("eco-saved")
  if (!toast) {
    toast = document.createElement("div")
    toast.id = "eco-saved"
    panel.appendChild(toast)
  }
  toast.innerHTML = html
  window.setTimeout(() => { toast?.remove() }, 5000)
}

// ---------- session accumulator (so it never "resets") ----------
const session = { tokens: 0, kwh: 0, g: 0, searches: 0, phone: 0 }

const addToSessionAndToast = (
  tokensSaved: number,
  kwhSaved: number,
  gSaved: number,
  searchesSaved: number,
  phoneChargesSaved: number,
  label?: string
) => {
  session.tokens   += Math.round(tokensSaved)
  session.kwh      += kwhSaved
  session.g        += gSaved
  session.searches += searchesSaved
  session.phone    += phoneChargesSaved

  const action = `
    ${label ? `<div class="small"><b>${label}</b></div>` : ``}
    Saved <b>${fmtInt(tokensSaved)}</b> tokens, <b>${fmtKWh(kwhSaved)}</b>, <b>${fmtG(gSaved)}</b><br/>
    ≈ ${fmtEq(searchesSaved)} searches ·
    ≈ ${fmtPhoneCharge(phoneChargesSaved)} of a phone charge
  `
  const total = `
    <div class="small" style="margin-top:6px;opacity:.9">
      Total this session: <b>${fmtInt(session.tokens)}</b> tokens · ${fmtKWh(session.kwh)} · ${fmtG(session.g)}
    </div>
  `
  showSavedToast(action + total)
}

// ---------- cumulative stats ----------
const recordCumulative = async (tokensSaved: number, gSaved: number) => {
  try {
    if (!canUseChrome()) return
    const { ecoStats } = await chrome.storage.local.get("ecoStats")
    const v = (ecoStats && typeof ecoStats === "object")
      ? ecoStats
      : { tokens_saved: 0, co2_saved_g: 0, queries_rewritten: 0 }
    v.tokens_saved = (v.tokens_saved || 0) + Math.round(tokensSaved)
    v.co2_saved_g = (v.co2_saved_g || 0) + gSaved
    v.queries_rewritten = (v.queries_rewritten || 0) + 1
    await chrome.storage.local.set({ ecoStats: v })
  } catch {}
}

// Snapshot tokens *before* the last Trim click; send uses this vs current editor
let pendingTrimBeforeTokens: number | null = null

// ---------- render ----------
const render = () => {
  ensureStyle()
  const panel = ensurePanel()

  const raw = (currentPrompt || getEditorText() || "").replace(/\s+/g, " ").trim()

  if (raw && raw !== lastLuckyQuery) {
    lastLuckyQuery = raw
    resolveLuckyInBg(raw)
  }

  const tokens = safeTokenize(raw)
  const impact = tokensToImpact(tokens)

  safeStore({ currentTokens: tokens, currentSource: "chatgpt" })

  const existingToast = document.getElementById("eco-saved")
  const toastHTML = existingToast ? existingToast.outerHTML : ""

  const href  = resolvedLuckyUrl || (raw ? luckyUrl(raw) : "")
  const title = resolvedLuckyTitle || (href ? new URL(href).hostname.replace(/^www\./, "") : "")

  const googleSection = raw && href ? `
    <div class="row google small">
      Top web result:
      <div>
        <a id="eco-google-link" class="link" href="${href}" target="_blank" rel="noopener noreferrer">
          ${title}
        </a>
        <div class="tiny url">${href}</div>
      </div>
    </div>` : ""

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
    ${toastHTML}
    ${googleSection}
  `

  // Trim button
  const btn = panel.querySelector<HTMLButtonElement>("#eco-trim")
  if (btn) {
    btn.onclick = () => {
      const beforeText = getEditorText()
      const afterText  = stripFillers(beforeText)
      if (afterText !== beforeText) {
        pendingTrimBeforeTokens = safeTokenize(beforeText) // snapshot before
        setEditorText(afterText)
        currentPrompt = afterText
      } else {
        pendingTrimBeforeTokens = null
      }
    }
  }

  // When user chooses the Google link, credit the *entire prompt* and accumulate
  const glink = panel.querySelector<HTMLAnchorElement>("#eco-google-link")
  if (glink) {
    glink.addEventListener("click", () => {
      const text = (getEditorText() || "").trim()
      const tks  = safeTokenize(text)
      const imp  = tokensToImpact(tks)

      const fullTokensSaved = Math.max(0, imp.tokens)
      if (fullTokensSaved > 0) {
        addToSessionAndToast(
          fullTokensSaved, imp.kwh, imp.gCO2, imp.eq.googleSearches, imp.eq.phoneCharges,
          "Opened top web result"
        )
        recordCumulative(fullTokensSaved, imp.gCO2)
        addSavedTokensToProfile(fullTokensSaved)
      }

      // We *do* want to allow later Trim savings to stack, but not double-count this one.
      pendingTrimBeforeTokens = null
    }, { once: true, capture: true })
  }
}

const debouncedRender = debounce(render, 150)

// ---------- send handlers (Trim → Enter flow) ----------
const isSendButton = (n: Element | null): boolean => {
  if (!n) return false
  const el = n as HTMLElement
  return !!(
    el.closest('button[data-testid="send-button"]') ||
    el.closest('button[aria-label^="Send"]') ||
    el.closest('[data-testid="composer:button-send"]')
  )
}

const onSend = () => {
  if (pendingTrimBeforeTokens == null) return

  const currentText   = (getEditorText() || "").trim()
  const currentTokens = safeTokenize(currentText)

  const b = tokensToImpact(pendingTrimBeforeTokens)
  const a = tokensToImpact(currentTokens)

  const tokensSaved       = Math.max(0, b.tokens - a.tokens)
  const kwhSaved          = Math.max(0, b.kwh - a.kwh)
  const gSaved            = Math.max(0, b.gCO2 - a.gCO2)
  const searchesSaved     = Math.max(0, b.eq.googleSearches - a.eq.googleSearches)
  const phoneChargesSaved = Math.max(0, b.eq.phoneCharges - a.eq.phoneCharges)

  addToSessionAndToast(tokensSaved, kwhSaved, gSaved, searchesSaved, phoneChargesSaved, "Trimmed prompt")

  recordCumulative(tokensSaved, gSaved)
  addSavedTokensToProfile(tokensSaved)

  pendingTrimBeforeTokens = null
  debouncedRender()
}

// Click send (capture)
document.addEventListener("click", (ev) => {
  const t = ev.target as Element | null
  if (isSendButton(t)) onSend()
}, true)

// Enter to send (capture)
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey && isEditorEl(document.activeElement)) onSend()
}, true)

// ---------- boot & listeners ----------
const main = () => {
  render()

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

  const mo = new MutationObserver(debouncedRender)
  mo.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("resize", debouncedRender)
  window.addEventListener("scroll", debouncedRender, true)

  setInterval(debouncedRender, 1200)
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", main, { once: true })
} else {
  main()
}
