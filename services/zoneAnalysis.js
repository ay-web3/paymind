// services/zoneAnalysis.js


export function calculateZonesFromVolume(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  
  
  const buckets = {};
  const lastPrice = candles[candles.length - 1].c;
  const prices = candles.map(c => c.c);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Adaptive bucket size (0.25% of current price)
  const bucketSize = lastPrice * 0.0025;

  candles.forEach(c => {
    if (
      typeof c?.c !== "number" ||
      typeof c?.v !== "number"
    ) return;

    const bucket =
      Math.round(c.c / bucketSize) * bucketSize;

    buckets[bucket] = (buckets[bucket] || 0) + c.v;
  });

  const allZones = Object.entries(buckets)
  .map(([price, volume]) => ({
    price: Number(price),
    volume
  }))
  .sort((a, b) => b.volume - a.volume);

  const nearRange = lastPrice * 0.01; // ±1%

const supports = allZones
  .filter(z => z.price < lastPrice)
  .slice(0, 4);

const resistances = allZones
  .filter(z => z.price > lastPrice)
  .slice(0, 4);

const balance = allZones.filter(
  z => Math.abs(z.price - lastPrice) <= nearRange
);

const selectedZones = [
  ...supports.slice(0, 2),
  ...balance.slice(0, 2),
  ...resistances.slice(0, 2)
];

if (!selectedZones.length) return [];

const maxVolume = Math.max(
  ...selectedZones.map(z => z.volume)
);

  return selectedZones.map(z => {
  const padding = z.price * 0.005;

  return {
    price: z.price,
    volume: z.volume,
    low: z.price - padding,
    high: z.price + padding,
    type: z.price < lastPrice ? "support" : "resistance",
    strength: Number((z.volume / maxVolume).toFixed(2)),
    method: "volume_profile_structured"
  };
});
}

export function rankZonesByStrength(zones, candles) {
  if (!zones?.length || !candles?.length) return [];

  const lastPrice = candles[candles.length - 1].c;

  // --- 1. Find max volume for normalization
  const maxVolume = Math.max(...zones.map(z => z.volume || 1));

  return zones
    .map(zone => {
      // --- 2. Normalize volume
      const volumeScore = (zone.volume || 0) / maxVolume;

      // --- 3. Count touches
      let touches = 0;
      for (const c of candles) {
        if (c.h >= zone.low && c.l <= zone.high) {
          touches++;
        }
      }

      // --- 4. Proximity score (closer = stronger)
      const mid = (zone.low + zone.high) / 2;
      const distance = Math.abs(lastPrice - mid) / lastPrice;
      const proximityScore = Math.max(0, 1 - distance * 5); // decay

      // --- 5. Final strength
      const strength =
        volumeScore * 0.5 +
        Math.min(touches / 10, 1) * 0.3 +
        proximityScore * 0.2;

      return {
        ...zone,
        touches,
        strength: Number(strength.toFixed(3))
      };
    })
    // --- 6. Sort strongest → weakest
    .sort((a, b) => b.strength - a.strength);
}
