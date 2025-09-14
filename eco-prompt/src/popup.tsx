// src/popup.tsx
import { useState } from "react"
import { tokensToImpact, fmtInt, fmtKWh, fmtG } from "./lib/co2"

export default function Popup() {
  const [tokens, setTokens] = useState<number>(500000) // try 500k by default
  const impact = tokensToImpact(tokens)

  return (
    <div style={{ minWidth: 280, padding: 14, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontWeight: 600, marginBottom: 8 }}>EcoPrompt 🌱</h2>

      <label style={{ fontSize: 12, opacity: 0.8 }}>Tokens</label>
      <input
        type="number"
        value={tokens}
        onChange={(e) => setTokens(parseInt(e.target.value || "0", 10))}
        style={{
          width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd",
          margin: "6px 0 10px"
        }}
      />

      <div style={{ lineHeight: 1.6 }}>
        <div>Energy: {fmtKWh(impact.kwh)}</div>
        <div>Emissions: {fmtG(impact.gCO2)}</div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>
        ≈ {fmtInt(impact.eq.phoneCharges)} phone charges ·{" "}
        ≈ {fmtInt(impact.eq.bulbHours60W)} h (60W) ·{" "}
        ≈ {fmtInt(impact.eq.googleSearches)} searches
      </div>
    </div>
  )
}