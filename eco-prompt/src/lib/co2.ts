// src/lib/co2.ts
// -------------------------------------------------------------
// Converts AI token usage into energy (kWh), CO₂ emissions (g),
// and human-friendly equivalents (phone charges, lightbulb hours, etc).
// -------------------------------------------------------------

export const FACTORS = {
  // Baseline: ~1,000,000 tokens ≈ 1 kWh of compute
  tokensPerKWh: 1_000_000,

  // Global average grid intensity: grams CO₂ per kWh
  gCO2PerKWh: 400,

  // Everyday equivalences
  googleSearch_gCO2: 0.3,   // ~0.3 g CO₂ per Google search
  phoneCharge_kWh: 0.012,   // ~12 Wh (0.012 kWh) per phone charge
  bulb60W_W: 60,            // 60 W incandescent bulb
  led9W_W: 9                // 9 W LED bulb
} as const

// ---------------- Core conversions ----------------
export const tokensToKwh = (tokens: number): number =>
  tokens / FACTORS.tokensPerKWh

export const kwhToGCO2 = (kwh: number): number =>
  kwh * FACTORS.gCO2PerKWh

export const tokensToGCO2 = (tokens: number): number =>
  kwhToGCO2(tokensToKwh(tokens))

// ---------------- Human-friendly equivalents ----------------
export const gCO2ToSearchEq = (g: number): number =>
  g / FACTORS.googleSearch_gCO2

export const kwhToPhoneCharges = (kwh: number): number =>
  kwh / FACTORS.phoneCharge_kWh

export const kwhToLightbulbHours = (kwh: number): number =>
  (kwh * 1000) / FACTORS.bulb60W_W

// ---------------- One-call UI helper ----------------
export type Impact = {
  tokens: number
  kwh: number
  gCO2: number
  eq: {
    googleSearches: number
    phoneCharges: number
    bulbHours60W: number
  }
}

/**
 * tokensToImpact
 * - Main function you'll use in the UI.
 * - Input: number of tokens
 * - Output: kWh, g CO₂, and equivalences (all in one object).
 */

export const tokensToImpact = (tokens: number): Impact => {
  const kwh = tokensToKwh(tokens)
  const g = kwhToGCO2(kwh)
  return {
    tokens,
    kwh,
    gCO2: g,
    eq: {
      googleSearches: gCO2ToSearchEq(g),
      phoneCharges: kwhToPhoneCharges(kwh),
      bulbHours60W: kwhToLightbulbHours(kwh),
    }
  }
}