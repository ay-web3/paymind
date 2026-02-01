// services/marketStructure.js

/**
 * 1️⃣ Detect swing highs & lows (fractal-based)
 */
export function detectMarketStructure(candles, lookback = 2) {
  if (!Array.isArray(candles) || candles.length < lookback * 2 + 1) {
    return [];
  }

  const swings = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const curr = candles[i];
    const left = candles.slice(i - lookback, i);
    const right = candles.slice(i + 1, i + 1 + lookback);

    const isSwingHigh =
      left.every(c => c.h < curr.h) &&
      right.every(c => c.h < curr.h);

    const isSwingLow =
      left.every(c => c.l > curr.l) &&
      right.every(c => c.l > curr.l);

    if (isSwingHigh) {
      swings.push({
        type: "high",
        price: curr.h,
        index: i,
        time: curr.x
      });
    }

    if (isSwingLow) {
      swings.push({
        type: "low",
        price: curr.l,
        index: i,
        time: curr.x
      });
    }
  }

  return swings;
}

/**
 * 2️⃣ Analyze structure → BOS / CHoCH / Bias
 */
export function analyzeMarketStructure(candles) {
  if (!Array.isArray(candles) || candles.length < 10) return null;

  const swings = detectMarketStructure(candles);

  if (swings.length < 2) {
    return {
      bias: "range",
      swings,
      event: null
    };
  }

  const lastClose = candles[candles.length - 1].c;
  const lastTime = candles[candles.length - 1].x;

  const lastHigh = [...swings].reverse().find(s => s.type === "high");
  const lastLow = [...swings].reverse().find(s => s.type === "low");

  let bias = "range";
  let event = null;

  // --- Bullish break
  if (lastHigh && lastClose > lastHigh.price) {
    event = {
      type: bias === "bearish" ? "CHoCH" : "BOS",
      direction: "bullish",
      price: lastHigh.price,
      time: lastTime
    };
    bias = "bullish";
  }

  // --- Bearish break
  if (lastLow && lastClose < lastLow.price) {
    event = {
      type: bias === "bullish" ? "CHoCH" : "BOS",
      direction: "bearish",
      price: lastLow.price,
      time: lastTime
    };
    bias = "bearish";
  }

  return {
    bias,
    swings,
    event
  };
}
