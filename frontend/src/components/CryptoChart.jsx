import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  TimeScale,
  Tooltip,
  CategoryScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Legend
} from "chart.js";
import { useMemo } from "react";
import {
  CandlestickController,
  CandlestickElement
} from "chartjs-chart-financial";
import zoomPlugin from "chartjs-plugin-zoom";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import { Filler } from "chart.js";
import TradePlanCard from "./TradePlanCard";


ChartJS.register(
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Legend,
  BarController,
  zoomPlugin,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CandlestickController,
  CandlestickElement,
  Filler
);

const API_BASE =
  "http://34.172.199.194:3000";



export default function CryptoChart({ coin, initialTimeframe = "1h" }) {
  
  async function loadLivePrice() {
  try {
    const res = await fetch(
      `${API_BASE}/crypto/live-price?coin=${coin}`
    );
    const data = await res.json();
    setLivePrice(data.price);
  } catch (err) {
    console.error("Live price fetch failed", err);
  }
}

useEffect(() => {
  loadLivePrice();

  const id = setInterval(loadLivePrice, 15000); // every 15s
  return () => clearInterval(id);
}, [coin]);


  /* ======================
     State
  ====================== */
  const COLORS = {
  bg: "#020617",
  panel: "#020617",
  grid: "rgba(255,255,255,0.06)",
  text: "#cbd5f5",
  muted: "#64748b",
  green: "#16c784",
  red: "#ea3943",
  cyan: "#22d3ee",
  yellow: "#facc15",
  purple: "#a855f7"
};

  const ZONE_PADDING = 0.005; // 0.5% zone thickness
  const [candles, setCandles] = useState([]);
  const [ema20, setEma20] = useState([]);
  const [ema50, setEma50] = useState([]);
  const [rsi, setRsi] = useState([]);

  const [showEMA, setShowEMA] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange24h, setPriceChange24h] = useState(null);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [hasPaid, setHasPaid] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [zones, setZones] = useState([]);
  const [locked, setLocked] = useState(true);
  const [paying, setPaying] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [vwap, setVwap] = useState([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
  const mq = window.matchMedia("(max-width: 900px)");
  const update = () => setIsMobile(mq.matches);

  update();
  mq.addEventListener("change", update);

  return () => mq.removeEventListener("change", update);
}, []);

  useEffect(() => {
  setTimeframe(initialTimeframe);
}, [initialTimeframe]);
  /* ======================
     Load chart data
  ====================== */
  
  async function load() {
    try {
      const res = await fetch(
        `${API_BASE}/crypto/chart?coin=${coin}&tf=${timeframe}`
      );
      const data = await res.json();

      const cleanCandles = Array.isArray(data.candles)
        ? data.candles.filter(
            c =>
              c &&
              typeof c.x === "number" &&
              typeof c.o === "number" &&
              typeof c.h === "number" &&
              typeof c.l === "number" &&
              typeof c.c === "number"
          )
        : [];

      setCandles(cleanCandles);
      setEma20(data.ema20 || []);
      setEma50(data.ema50 || []);
      setRsi(data.rsi || []);
      setZones([]);
      setLocked(true);

      if (cleanCandles.length > 0) {
        const last = cleanCandles[cleanCandles.length - 1];
        setCurrentPrice(last.c);

        if (cleanCandles.length > 1) {
          const target = last.x - 24 * 60 * 60 * 1000;
          let prev = cleanCandles[0].c;

          for (let i = cleanCandles.length - 1; i >= 0; i--) {
            if (cleanCandles[i].x <= target) {
              prev = cleanCandles[i].c;
              break;
            }
          }

          setPriceChange24h(((last.c - prev) / prev) * 100);
        }
      }
    } catch (err) {
      console.error("Chart load failed", err);
    }
  }

  useEffect(() => {
    load();
  }, [coin, timeframe]);

  // Auto refresh
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [coin, timeframe]);

  useEffect(() => {
  // reset paid/analysis state when coin or timeframe changes
  setHasPaid(false);
  setAnalysis(null);
  setAiExplanation("");
  setVwap([]);
  setZones([]);
  setLocked(true);
}, [coin, timeframe]);

  async function unlockAnalysis() {
  try {
    setPaying(true);

    // 🔐 Ensure wallet is connected
    if (!window.ethereum) {
      throw new Error("Wallet not detected");
    }

    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    if (!address) {
      throw new Error("Wallet connection failed");
    }

    // 📡 Request paid analysis
    const res = await fetch(`${API_BASE}/analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userAddress: address,
        coin,
        tf: timeframe
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Payment or analysis failed");
    }

    console.log("PAID ANALYSIS RESPONSE:", data);

    // ✅ Hydrate frontend state from backend
    
    setAnalysis(data.analysis);
    setVwap(data.analysis?.vwapSeries || []);
    setAiExplanation(data.analysis?.explanation || "");
    setHasPaid(true);
    setLocked(false);

  } catch (err) {
    console.error("Unlock analysis failed:", err);
    alert(err.message);
  } finally {
    setPaying(false);
  }
}



  /* ======================
     Datasets
  ====================== */
  const candleDataset = {
  type: "candlestick",
  data: candles,
  parsing: false,
  yAxisID: "price",
  barThickness: 6,
  maxBarThickness: 8,
  color: {
    up: COLORS.green,
    down: COLORS.red,
    unchanged: COLORS.muted
  }
};


  const volumeDataset = {
  type: "bar",
  data: candles.map(c => ({ x: c.x, y: c.v || 0 })),
  yAxisID: "volume",
  backgroundColor: "rgba(148,163,184,0.18)", // slate tone
  barThickness: 6,
  borderRadius: 2
};

  const ema20Dataset = {
  type: "line",
  data: ema20
    .map((v, i) =>
      typeof v === "number" && candles[i]
        ? { x: candles[i].x, y: v }
        : null
    )
    .filter(Boolean),
  borderColor: COLORS.cyan,
  borderWidth: 1.2,
  pointRadius: 0,
  tension: 0.3,
  yAxisID: "price"
};

const ema50Dataset = {
  type: "line",
  data: ema50
    .map((v, i) =>
      typeof v === "number" && candles[i]
        ? { x: candles[i].x, y: v }
        : null
    )
    .filter(Boolean),
  borderColor: COLORS.yellow,
  borderWidth: 1.2,
  pointRadius: 0,
  tension: 0.3,
  yAxisID: "price"
};



const vwapDataset = useMemo(() => {
  if (!vwap.length || !candles.length) return null;

  return {
    type: "line",
    label: "VWAP",
    data: vwap
      .map((v, i) =>
        typeof v === "number" && candles[i]
          ? { x: candles[i].x, y: v }
          : null
      )
      .filter(Boolean),
    borderColor: "#38bdf8", // sky blue
    borderWidth: 1.8,
    pointRadius: 0,
    tension: 0.25,
    yAxisID: "price"
  };
}, [vwap, candles]);

const rsiOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      type: "time",
      display: false
    },
    y: {
      min: 0,
      max: 100,
      ticks: {
        callback: v => ([30, 50, 70].includes(v) ? v : "")
      },
      grid: {
        color: COLORS.grid},
      
      afterBuildTicks: scale => {
        scale.ticks = [
          { value: 30 },
          { value: 50 },
          { value: 70 }
        ];
      }
    }
  }
};

  const zonesFromAnalysis = analysis?.zones;
const structure = analysis?.structure;

  const bosDataset = useMemo(() => {
  if (!hasPaid || !structure?.bos || !candles.length) return [];

  const level = structure.bos.level;

  return [
    {
      label: "BOS",
      type: "line",
      data: candles.map(c => ({ x: c.x, y: level })),
      borderColor:
        structure.bos.type === "bullish_bos"
          ? "rgba(22,199,132,0.9)"
          : "rgba(234,57,67,0.9)",
      borderWidth: 2,
      borderDash: [6, 6],
      pointRadius: 0,
      yAxisID: "price"
    }
  ];
}, [hasPaid, structure, candles]);

const invalidation = analysis?.invalidation || analysis?.facts?.invalidation;

const invalidationDatasets = useMemo(() => {
  if (!hasPaid || !invalidation || !candles.length) return [];

  const mkLine = (label, level, color, dash = [6, 6]) => ({
    label,
    type: "line",
    parsing: false,
    order: 20,
    data: candles.map(c => ({ x: c.x, y: level })),
    borderColor: color,
    borderWidth: 2,
    borderDash: dash,
    pointRadius: 0,
    yAxisID: "price"
  });

  // Trend invalidation
  if (Number.isFinite(invalidation.level)) {
    const color =
      invalidation.side === "bullish"
        ? "rgba(234,57,67,0.9)" // red (bull invalidation is below)
        : "rgba(22,199,132,0.9)"; // green (bear invalidation is above)

    return [mkLine("Invalidation", invalidation.level, color, [8, 6])];
  }

  // Range invalidation (upper + lower)
  if (
    Number.isFinite(invalidation.upper) &&
    Number.isFinite(invalidation.lower)
  ) {
    return [
      mkLine(
        "Range Upper Break",
        invalidation.upper,
        "rgba(255,255,255,0.45)",
        [6, 6]
      ),
      mkLine(
        "Range Lower Break",
        invalidation.lower,
        "rgba(255,255,255,0.45)",
        [6, 6]
      )
    ];
  }

  return [];
}, [hasPaid, invalidation, candles]);

const zoneDatasets = useMemo(() => {
  if (!hasPaid || !zonesFromAnalysis?.length || !candles.length) return [];

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle?.c;
  if (!currentPrice) return [];

  const maxStrength = Math.max(
    ...zonesFromAnalysis.map(z => z.strength || 1)
  );

  return zonesFromAnalysis.flatMap((z, idx) => {
    const low = Number(z.low);
    const high = Number(z.high);
    if (!low || !high) return [];

    const strength = z.strength || 1;

    // map strength → opacity (0.1 → 0.45)
    const opacity = Math.min(
      0.1 + (strength / maxStrength) * 0.35,
      0.45
    );

    // 🔑 Dynamic support / resistance based on CURRENT price
    const isSupport = high < currentPrice;

    const color = isSupport
      ? `rgba(22,199,132,${opacity})`
      : `rgba(234,57,67,${opacity})`;

    const isMajor = strength === maxStrength;

    return [
      {
        label: `zone-low-${idx}`,
        type: "line",
        data: candles.map(c => ({ x: c.x, y: low })),
        backgroundColor: color,
        borderColor: "transparent",
        fill: { target: "+1" },
        pointRadius: 0,
        borderWidth: 0,
        yAxisID: "price"
      },
      {
        label: `zone-high-${idx}`,
        type: "line",
        data: candles.map(c => ({ x: c.x, y: high })),
        borderColor: isMajor
          ? "rgba(255,255,255,0.35)"
          : "transparent",
        borderWidth: isMajor ? 1 : 0,
        pointRadius: 0,
        yAxisID: "price"
      }
    ];
  });
}, [hasPaid, zonesFromAnalysis, candles]);




const swingDatasets = useMemo(() => {
  if (!hasPaid || !structure?.swings?.length || !candles.length) return [];

  const highs = structure.swings.filter(s => s.type === "high");
  const lows = structure.swings.filter(s => s.type === "low");

  return [
    {
      label: "Swing Highs",
      type: "scatter",
      parsing: false,
      order: 10,
      data: highs.map(s => ({ x: s.time, y: s.price })),
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "rgba(234,57,67,1)",
      yAxisID: "price"
    },
    {
      label: "Swing Lows",
      type: "scatter",
      parsing: false,
      order: 10,
      data: lows.map(s => ({ x: s.time, y: s.price })),
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "rgba(22,199,132,1)",
      yAxisID: "price"
    }
  ];
}, [hasPaid, structure, candles]);

const structureEventDataset = useMemo(() => {
  if (!hasPaid || !structure?.event || !candles.length) return [];

  const { event } = structure;

  return [
    {
      label: event.type,
      type: "line",
      parsing: false,
      order: 12,
      data: candles.map(c => ({
        x: c.x,
        y: event.price
      })),
      borderColor:
        event.direction === "bullish"
          ? "rgba(22,199,132,0.85)"
          : "rgba(234,57,67,0.85)",
      borderWidth: event.type === "BOS" ? 2.5 : 2,
      borderDash: event.type === "CHoCH" ? [6, 6] : [],
      pointRadius: 0,
      yAxisID: "price"
    }
  ];
}, [hasPaid, structure, candles]);



  const chartData = useMemo(
  () => ({
    datasets: [
    ...zoneDatasets,     // background
    ...swingDatasets,
    ...structureEventDataset,
  ...bosDataset,       // structure
  ...invalidationDatasets,
  candleDataset,
  ...(showEMA ? [ema20Dataset, ema50Dataset] : []),
  ...(vwapDataset ? [vwapDataset] : []),
  volumeDataset
]
  }),
  [zoneDatasets, candles, ema20, ema50, showEMA, livePrice]
);



  

const rsiChartData = useMemo(() => ({
  datasets: [
    {
      type: "line",
      data: rsi
        .map((v, i) =>
          typeof v === "number" && candles[i]
            ? { x: candles[i].x, y: v }
            : null
        )
        .filter(Boolean),
      borderColor: COLORS.purple,
      borderWidth: 1.5,
      pointRadius: 0
    }
  ]
}), [rsi, candles]);

if (!candles.length) {
    return <div className="glass-card">Loading chart…</div>;
  }

  const priceOptions = {
  responsive: true,
  maintainAspectRatio: false,
  normalized: true,

  plugins: {
    legend: { display: false },
    

    zoom: {
      pan: {
        enabled: true,
        mode: "x",
        modifierKey: "shift"
      },

      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: "x",
        limits: {
          x: {
            minRange: 60 * 60 * 1000 // ⏱️ 1 hour minimum
          }
        }
      }
    }
  },

  scales: {
    x: {
      type: "time",
      grid: { color: COLORS.grid },
      ticks: {
        autoSkip: true,
        maxTicksLimit: 12
      }
    },

    price: {
      position: "left",
      weight: 3,
      grid: {
        color: COLORS.grid
      }
    },
        
    volume: {
      display: false,
      position: "right",
      beginAtZero: true,
      weight: 0.2,
      stacked: true,
  min: 0,
  max: Math.max(...candles.map(c => c.v || 0)) * 3
    },

     
      
   }
};

  /* ======================
     Render
  ====================== */
 return (
  <div
    className="sv-terminal-v2"
    style={{
      height: 900,
      background: "#09090b",
      borderRadius: 16,
      border: "1px solid #27272a",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
      color: "#fafafa",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      overflow: "hidden", // ✅ outer container should NOT scroll
    }}
  >
    {/* ───────────────── COMPACT HEADER ───────────────── */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        background: "#09090b",
        borderBottom: "1px solid #18181b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>
          {coin.toUpperCase()}/USD
        </span>

        <span style={{ fontSize: 13, fontWeight: 700 }}>
          ${livePrice?.toLocaleString?.() ?? livePrice}
        </span>

        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: (priceChange24h ?? 0) >= 0 ? "#10b981" : "#ef4444",
          }}
        >
          {(priceChange24h ?? 0) >= 0 ? "+" : ""}
          {Number.isFinite(priceChange24h) ? priceChange24h.toFixed(2) : "0.00"}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            background: "#18181b",
            padding: 2,
            borderRadius: 8,
            border: "1px solid #27272a",
          }}
        >
          {["1h", "1d", "7d"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: "4px 10px",
                background: timeframe === tf ? "#27272a" : "transparent",
                color: timeframe === tf ? "#ffffff" : "#71717a",
                border: "none",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                borderRadius: 6,
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          style={{
            background: "none",
            border: "1px solid #27272a",
            color: "#71717a",
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Refresh"
        >
          ↻
        </button>
      </div>
    </div>

    {/* ───────────────── STRUCTURE & OHLC BAR ───────────────── */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        gap: 16,
        background: "#09090b",
        borderBottom: "1px solid #18181b",
      }}
    >
      {/* MARKET STRUCTURE */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingRight: 16,
          borderRight: "1px solid #27272a",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              structure?.bias === "bullish"
                ? "#10b981"
                : structure?.bias === "bearish"
                ? "#ef4444"
                : "#eab308",
            boxShadow: `0 0 6px ${
              structure?.bias === "bullish"
                ? "rgba(16,185,129,0.35)"
                : structure?.bias === "bearish"
                ? "rgba(239,68,68,0.35)"
                : "rgba(234,179,8,0.35)"
            }`,
          }}
        />

        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.6px",
            color: "#e4e4e7",
          }}
        >
          STRUCTURE:
          <span
            style={{
              marginLeft: 6,
              color:
                structure?.bias === "bullish"
                  ? "#10b981"
                  : structure?.bias === "bearish"
                  ? "#ef4444"
                  : "#eab308",
            }}
          >
            {structure?.bias?.toUpperCase?.() || "RANGING"}
          </span>
        </span>

        {analysis?.mtf?.enabled && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.6px",
              color: "#a1a1aa",
            }}
          >
            MTF:
            <span
              style={{
                marginLeft: 6,
                color: analysis.mtf.aligned ? "#10b981" : "#ef4444",
              }}
            >
              {String(analysis.mtf.htfTf || "").toUpperCase()}{" "}
              {String(analysis.mtf.htfBias || "").toUpperCase()} (
              {analysis.mtf.status})
            </span>
          </span>
        )}

        {structure?.event && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.6px",
              color: "#a1a1aa",
            }}
          >
            EVENT:
            <span
              style={{
                marginLeft: 6,
                color:
                  structure.event.direction === "bullish"
                    ? "#10b981"
                    : "#ef4444",
              }}
            >
              {String(structure.event.type || "").toUpperCase()}
            </span>
          </span>
        )}
      </div>

      {/* OHLC DATA */}
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 10,
          fontWeight: 500,
          color: "#71717a",
          flexWrap: "wrap",
        }}
      >
        <span>
          O <span style={{ color: "#e4e4e7" }}>{currentPrice?.toLocaleString?.() ?? currentPrice}</span>
        </span>
        <span>
          H <span style={{ color: "#e4e4e7" }}>{currentPrice?.toLocaleString?.() ?? currentPrice}</span>
        </span>
        <span>
          L <span style={{ color: "#e4e4e7" }}>{currentPrice?.toLocaleString?.() ?? currentPrice}</span>
        </span>
        <span>
          C <span style={{ color: "#e4e4e7" }}>{currentPrice?.toLocaleString?.() ?? currentPrice}</span>
        </span>
      </div>
    </div>

    {/* ✅ MAIN BODY: RESPONSIVE */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
      {/* LEFT: Chart + RSI + AI explanation (scrolls) */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          borderRight: isMobile ? "none" : "1px solid #18181b",
            borderBottom: isMobile ? "1px solid #18181b" : "none",
          overflow: "hidden",
        }}
      >
        {/* LEFT SCROLL AREA */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          {/* ───────────────── MAIN CHART ───────────────── */}
          <div style={{ height: isMobile ? 360 : 540, position: "relative", cursor: "crosshair" }}>
            {/* TRADINGVIEW STYLE PRICE LABEL */}
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "42%",
                zIndex: 10,
                background: "#27272a",
                color: "#ffffff",
                padding: "2px 6px",
                fontSize: 10,
                fontWeight: 600,
                border: "1px solid #3f3f46",
                borderRadius: "2px 0 0 2px",
              }}
            >
              {livePrice?.toLocaleString?.() ?? livePrice}
            </div>

            {/* LOADING OVERLAY */}
            {paying && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(9, 9, 11, 0.85)",
                  backdropFilter: "blur(4px)",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    border: "2px solid rgba(255,255,255,0.05)",
                    borderTop: "2px solid #ffffff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#71717a",
                    letterSpacing: "1px",
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  SYNCING...
                  <br />
                  PAYING X402 ACCESS
                </span>
              </div>
            )}

            <Chart
              key={`price-${coin}-${timeframe}`}
              data={chartData}
              options={priceOptions}
            />
          </div>

          {/* ───────────────── RSI ───────────────── */}
          <div
            style={{
              height: 150,
              borderTop: "1px solid #18181b",
              background: "#09090b",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                fontSize: 9,
                color: "#3f3f46",
                fontWeight: 800,
                letterSpacing: "0.5px",
              }}
            >
              RELATIVE STRENGTH INDEX (14)
            </div>

            <div style={{ height: 110, padding: "0 8px 8px 8px" }}>
              <Chart
                key={`rsi-${coin}-${timeframe}`}
                data={rsiChartData}
                options={rsiOptions}
              />
            </div>
          </div>

          {/* ───────────────── AI EXPLANATION ───────────────── */}
          {hasPaid && aiExplanation && (
            <div
              style={{
                maxHeight: 160,
                overflowY: "auto",
                padding: "10px 16px",
                borderTop: "1px solid #18181b",
                background: "#09090b",
                fontSize: 11,
                lineHeight: 1.6,
                color: "#a1a1aa",
              }}
            >
              {aiExplanation.split("\n\n").map((p, i) => (
                <p key={i} style={{ marginBottom: 8 }}>
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* When not paid, show pay button at bottom of left column */}
          {!hasPaid && (
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #18181b",
                background: "#09090b",
              }}
            >
              <button
                onClick={unlockAnalysis}
                disabled={paying}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "transparent",
                  color: "#ffffff",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  border: "1px solid #27272a",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.color = "#000000";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#ffffff";
                }}
              >
                {paying ? "VERIFYING ACCESS..." : "REQUEST INSTITUTIONAL ANALYSIS"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Trade card (separate scroll, sticky option) */}
      <div
          style={{
            width: isMobile ? "100%" : 380,
            minWidth: isMobile ? 0 : 320,
            maxWidth: isMobile ? "100%" : "30%",
            padding: 16,
            overflowY: "auto",
            overflowX: "hidden",
            background: "#09090b",
          }}
        >
        {hasPaid ? (
          <div style={{ position: isMobile ? "relative" : "sticky", top: 12 }}>
            <TradePlanCard
              tradePlan={analysis?.tradePlan || analysis?.facts?.tradePlan}
            />
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #27272a",
              borderRadius: 12,
              padding: 14,
              color: "#a1a1aa",
              fontSize: 12,
              lineHeight: 1.5,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            Trade plan unlocks after paid analysis.
          </div>
        )}
      </div>
    </div>

    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
  </div>
);
}