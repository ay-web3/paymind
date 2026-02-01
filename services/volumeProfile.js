// services/volumeProfile.js

export function calculateVolumeProfile(candles) {
  const buckets = {};

  candles.forEach(c => {
    if (!c || typeof c.c !== "number") return;

    // Bucket prices (adjust bucket size if needed)
    const price = Math.round(c.c / 100) * 100;

    buckets[price] = (buckets[price] || 0) + (c.v || 0);
  });

  const sorted = Object.entries(buckets)
    .map(([price, volume]) => ({
      price: Number(price),
      volume
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6); // top 6 high-volume zones

  const currentPrice = candles[candles.length - 1]?.c;

  return sorted.map(zone => ({
    ...zone,
    type: zone.price < currentPrice ? "support" : "resistance"
  }));
}
