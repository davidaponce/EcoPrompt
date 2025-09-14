// popup.tsx
import { useEffect, useState } from "react"

type Stats = { tokens_saved: number; co2_saved_g: number; queries_rewritten: number }

export default function Popup() {
  const [stats, setStats] = useState<Stats>({ tokens_saved: 0, co2_saved_g: 0, queries_rewritten: 0 })

  useEffect(() => {
    const load = async () => {
      const { ecoStats } = await chrome.storage.local.get("ecoStats")
      if (ecoStats) setStats(ecoStats)
    }
    load()

    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes.ecoStats?.newValue) {
        setStats(changes.ecoStats.newValue)
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const reset = async () => {
    const fresh: Stats = { tokens_saved: 0, co2_saved_g: 0, queries_rewritten: 0 }
    await chrome.storage.local.set({ ecoStats: fresh })
    setStats(fresh)
  }

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "Inter, system-ui, Arial" }}>
      <h3 style={{ marginTop: 0 }}>EcoPrompt</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Stat label="Tokens saved" value={stats.tokens_saved.toLocaleString()} />
        <Stat label="CO₂ saved (g)" value={stats.co2_saved_g.toFixed(3)} />
        <Stat label="Rewrites" value={stats.queries_rewritten.toLocaleString()} />
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #dadce0",
          background: "#f1f3f4",
          cursor: "pointer"
        }}>
        Reset
      </button>

      <div style={{ marginTop: 12, fontSize: 12, color: "#5f6368" }}>
        Roadmap: full Grammarly-style underline, stats page + leaderboard, cloud sync.
      </div>
    </div>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      border: "1px solid #eaeaea",
      borderRadius: 10,
      padding: 10,
      background: "#fff"
    }}>
    <div style={{ fontSize: 12, color: "#5f6368" }}>{label}</div>
    <div style={{ fontWeight: 600, fontSize: 16 }}>{value}</div>
  </div>
)
