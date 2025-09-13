// v1 constants — tune later
export const FACTORS = {
  tokensPerKWh: 5_000_000, // ~5M tokens ≈ 1 kWh of compute
  gCO2PerKWh: 400          // 400 gCO₂ per kWh (avg grid)
}

export const tokensToKwh = (tokens: number) => tokens / FACTORS.tokensPerKWh
export const kwhToGCO2 = (kwh: number) => kwh * FACTORS.gCO2PerKWh
export const tokensToGCO2 = (tokens: number) => kwhToGCO2(tokensToKwh(tokens))

// 1 Google search ≈ 0.3 g CO₂ (v1)
export const gCO2ToSearchEq = (g: number) => g / 0.3