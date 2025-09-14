// src/lib/co2.ts
// -------------------------------------------------------------
// Converts AI token usage into energy (kWh), CO₂ emissions (g),
// and human-friendly equivalents (phone charges, lightbulb hours, etc).
// Supports profiles (conservative/typical/extreme) and includes
// model output tokens in the estimate.
// -------------------------------------------------------------

export const FACTORS = {
  // Everyday equivalences (keep these stable)
  phoneCharge_kWh: 0.012,  // ~12 Wh per full phone charge
  bulb60W_W: 60,           // 60 W incandescent bulb
  led9W_W: 9               // 9 W LED bulb
} as const

// ---------- Impact profiles (honest but with a "high-impact" option) ----------
export type ProfileKey = "conservative" | "typical" | "extreme"

/**
 * tokensPerKWh: tokens that consume 1 kWh (smaller => more energy per token)
 * gCO2PerKWh: grid intensity
 * googleSearch_gCO2: grams per Google search
 */
const PROFILES: Record<ProfileKey, {
  tokensPerKWh: number
  gCO2PerKWh: number
  googleSearch_gCO2: number
}> = {
  // Efficient deployment + clean grid
  conservative: { tokensPerKWh: 1_400_000, gCO2PerKWh: 200, googleSearch_gCO2: 0.3 },

  // Typical/median assumptions
  typical:      { tokensPerKWh: 1_000_000, gCO2PerKWh: 400, googleSearch_gCO2: 0.3 },

  // Older/larger/under-utilized model + coal-heavy grid (still plausible)
  // Also sets 0.2 g/search to make "searches" climb faster (within public ranges).
  extreme:      { tokensPerKWh:   500_000, gCO2PerKWh: 700, googleSearch_gCO2: 0.2 }
}

let activeProfile: ProfileKey = "typical"
export const setProfile = (p: ProfileKey) => { activeProfile = p }
const P = () => PROFILES[activeProfile]

// ---------- Output-token inclusion (so we count the full exchange) ----------
export const IMPACT_CONFIG = {
  includeOutput: true,   // count model output too
  completionMin: 150,    // minimum output tokens
  completionRatio: 1.5   // or ~1.5x the input, whichever is larger
}

export const estimateTotalTokens = (inputTokens: number): number => {
  // if the box is empty, show zero — don't add a minimum completion
  if (inputTokens <= 0) return 0

  if (!IMPACT_CONFIG.includeOutput) return inputTokens

  const estOut = Math.max(
    IMPACT_CONFIG.completionMin,
    Math.round(inputTokens * IMPACT_CONFIG.completionRatio)
  )
  return inputTokens + estOut
}

// ---------- Core conversions (use the active profile) ----------
export const tokensToKwh = (tokens: number): number => tokens / P().tokensPerKWh
export const kwhToGCO2  = (kwh: number): number => kwh * P().gCO2PerKWh
export const tokensToGCO2 = (tokens: number): number => kwhToGCO2(tokensToKwh(tokens))

// ---------- Equivalences ----------
export const gCO2ToSearchEq = (g: number): number => g / P().googleSearch_gCO2
export const kwhToPhoneCharges = (kwh: number): number => kwh / FACTORS.phoneCharge_kWh
export const kwhToLightbulbHours = (kwh: number): number => (kwh * 1000) / FACTORS.bulb60W_W
export const kwhToLedHours = (kwh: number): number => (kwh * 1000) / FACTORS.led9W_W

// ---------- One-call UI helper (now uses effective tokens) ----------
export type Impact = {
  tokens: number         // effective tokens (input + estimated output if enabled)
  kwh: number
  gCO2: number
  eq: {
    googleSearches: number
    phoneCharges: number
    bulbHours60W: number
    ledHours9W: number
  }
}

export const tokensToImpact = (inputTokens: number): Impact => {
  const effTokens = estimateTotalTokens(inputTokens)
  const kwh = tokensToKwh(effTokens)
  const g = kwhToGCO2(kwh)
  return {
    tokens: effTokens,
    kwh,
    gCO2: g,
    eq: {
      googleSearches: gCO2ToSearchEq(g),
      phoneCharges: kwhToPhoneCharges(kwh),
      bulbHours60W: kwhToLightbulbHours(kwh),
      ledHours9W: kwhToLedHours(kwh)
    }
  }
}

// ---------- Formatting helpers ----------
export const fmtKWh = (kwh: number): string => {
  if (kwh >= 1) return `${kwh.toFixed(2)} kWh`
  if (kwh >= 0.001) return `${(kwh * 1000).toFixed(2)} Wh`
  return `${(kwh * 1_000_000).toFixed(0)} mWh`
}

export const fmtG = (g: number): string => {
  if (g >= 1) return `${g.toFixed(2)} g CO₂`
  if (g >= 0.001) return `${(g * 1000).toFixed(2)} mg CO₂`
  return `${(g * 1_000_000).toFixed(0)} µg CO₂`
}

// Fraction-friendly for general equivalents
export const fmtEq = (n: number): string => {
  if (n === 0) return "0"
  if (n < 0.01) return "<0.01"
  if (n < 1) return n.toFixed(2)
  if (n < 10) return n.toFixed(1)
  return Math.round(n).toLocaleString()
}

// Phone charges as % when under 1 full charge
export const fmtPhoneCharge = (charges: number): string => {
  if (charges < 1) {
    const pct = charges * 100
    return pct < 1 ? "<1%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`
  }
  return Math.round(charges).toLocaleString()
}

// LED/incandescent time, switch to min/sec when < 1 hour
export const fmtBulbTime = (hours: number): string => {
  if (hours >= 1) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`
  const mins = hours * 60
  if (mins >= 1) return `${mins.toFixed(mins < 10 ? 1 : 0)} min`
  const secs = mins * 60
  return `${Math.max(1, Math.round(secs))} s`
}

// Simple integer formatting (used by your UI)
export const fmtInt = (n: number): string => Math.round(n).toLocaleString()

// Optional: always show kWh (no Wh/mWh)
export const fmtKWhStrict = (kwh: number, d = 6): string => `${kwh.toFixed(d)} kWh`