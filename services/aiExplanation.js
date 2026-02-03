export function generateAIExplanation({
  coin,
  timeframe,
  structure,
  nearestZone,
  ema,
  vwap,
  rsi,
  price
}) {
  const parts = [];

  // 1️⃣ STRUCTURE FIRST (CONTEXTUAL)
  parts.push(
    `${coin.toUpperCase()} is trading at $${price.toLocaleString()} on the ${timeframe} timeframe with a ${structure.bias.toUpperCase()} structural bias.`
  );

  // 2️⃣ STRUCTURAL EVENT (SPECIFIC)
  if (structure.event) {
    parts.push(
      `${structure.event.type} confirmed to the ${structure.event.direction.toUpperCase()} side at ${structure.event.price.toLocaleString()}, reinforcing directional control.`
    );
  } else {
    parts.push(
      `No Break of Structure or Change of Character has been confirmed, suggesting rotational or balanced conditions.`
    );
  }

  // 3️⃣ ZONE CONTEXT (NUMERIC)
  if (nearestZone) {
    parts.push(
      `Price is ${Math.abs(nearestZone.distancePct).toFixed(2)}% ${
        nearestZone.distancePct > 0 ? "above" : "below"
      } a ${nearestZone.type.toUpperCase()} liquidity zone between ${nearestZone.low.toLocaleString()}–${nearestZone.high.toLocaleString()}.`
    );
  }

  // 4️⃣ EMA + VWAP (REGIME-BASED, NOT GENERIC)
  if (Math.abs(ema.distancePct) < 0.3 && Math.abs(vwap.distancePct) < 0.3) {
  parts.push(
    `Price is tightly aligned with both EMA and VWAP, indicating equilibrium conditions and a lack of directional commitment.`
  );
} 
else if (ema.distancePct < -2 && vwap.distancePct < -2) {
  parts.push(
    `Price is trading significantly below EMA (${ema.distancePct.toFixed(1)}%) 
     and VWAP (${vwap.distancePct.toFixed(1)}%), signaling sustained institutional selling pressure.`
  );
} 
else if (ema.distancePct > 2 && vwap.distancePct > 2) {
  parts.push(
    `Price is holding well above EMA (${ema.distancePct.toFixed(1)}%) 
     and VWAP (${vwap.distancePct.toFixed(1)}%), confirming strong directional acceptance.`
  );
} 
else {
  parts.push(
    `Price is interacting with EMA and VWAP in a mixed regime, suggesting rotational behavior rather than trend expansion.`
  );
}


  // 5️⃣ RSI AS MOMENTUM (NOT ENTRY)
const rsiValue = rsi.value;
const rsiState = rsi.state;

parts.push(
  `RSI is currently at ${rsiValue.toFixed(1)}, indicating ${rsiState} momentum. 
   RSI is used strictly as momentum confirmation, not as a reversal signal.`
);





  // 6️⃣ FINAL VERDICT (STRUCTURE-FIRST)
  parts.push(
    `Bias remains ${structure.bias.toUpperCase()} unless invalidated by a structural break against the current direction.`
  );

  return parts.join("\n\n");
}
