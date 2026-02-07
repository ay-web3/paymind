import React from "react";

function pillStyle(decision) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.5px",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  if (decision === "long")
    return { ...base, color: "#10b981", background: "rgba(16,185,129,0.08)" };
  if (decision === "short")
    return { ...base, color: "#ef4444", background: "rgba(239,68,68,0.08)" };
  return { ...base, color: "#a1a1aa", background: "rgba(255,255,255,0.04)" };
}

function row(label, value) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <span style={{ color: "#a1a1aa", fontSize: 12 }}>{label}</span>
      <span style={{ color: "#e4e4e7", fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function TradePlanCard({ tradePlan }) {
  if (!tradePlan) return null;

  const decision = tradePlan.decision || "none";
  const isNone = decision === "none";

  const tp1 = tradePlan.tps?.[0]?.price ?? null;
  const tp2 = tradePlan.tps?.[1]?.price ?? null;

  return (
    <div
      className="glass-card"
      style={{
        marginTop: 16,
        background: "#09090b",
        border: "1px solid #27272a",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: "0.4px" }}>
          Trade Plan
        </h3>

        <span style={pillStyle(decision)}>
          {decision === "long" ? "LONG" : decision === "short" ? "SHORT" : "NO SETUP"}
        </span>
      </div>

      <div style={{ marginTop: 12, color: "#a1a1aa", fontSize: 12, lineHeight: 1.6 }}>
        {tradePlan.reason || (isNone ? "No setup available." : "")}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid #18181b", paddingTop: 12 }}>
        {row("Entry", tradePlan.entry ?? "—")}
        {row("Stop Loss", tradePlan.sl ?? "—")}
        {row("TP1", tp1 ?? "—")}
        {row("TP2", tp2 ?? "—")}
        {row("R/R", tradePlan.rr != null ? `${tradePlan.rr}R` : "—")}
      </div>

      {Array.isArray(tradePlan.conditions) && tradePlan.conditions.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #18181b", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", letterSpacing: "0.4px" }}>
            CONDITIONS
          </div>
          <ul style={{ marginTop: 8, paddingLeft: 18, color: "#a1a1aa", fontSize: 12, lineHeight: 1.6 }}>
            {tradePlan.conditions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {tradePlan.invalidation && (
        <div style={{ marginTop: 12, borderTop: "1px solid #18181b", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", letterSpacing: "0.4px" }}>
            INVALIDATION
          </div>
          <div style={{ marginTop: 6, color: "#a1a1aa", fontSize: 12, lineHeight: 1.6 }}>
            {typeof tradePlan.invalidation === "string"
              ? tradePlan.invalidation
              : tradePlan.invalidation?.text || JSON.stringify(tradePlan.invalidation)}
          </div>
        </div>
      )}
    </div>
  );
}
