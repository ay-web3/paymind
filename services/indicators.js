export function calculateEMA(prices, period = 14) {
  const k = 2 / (period + 1);
  let emaArray = [];

  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaArray[period - 1] = ema;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    emaArray[i] = ema;
  }

  return emaArray;
}

export function calculateRSI(prices, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rsiArray = Array(prices.length).fill(null);

  let rs = avgGain / avgLoss;
  rsiArray[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgGain / avgLoss;
    rsiArray[i] = 100 - 100 / (1 + rs);
  }

  return rsiArray;
}

export function calculateVWAP(candles) {
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  let lastDay = null;

  return candles.map(c => {
    const day = new Date(c.x).toDateString();

    if (day !== lastDay) {
      cumulativePV = 0;
      cumulativeVolume = 0;
      lastDay = day;
    }

    if (!c.v || c.v === 0) return null;

    const typicalPrice = (c.h + c.l + c.c) / 3;
    cumulativePV += typicalPrice * c.v;
    cumulativeVolume += c.v;

    return cumulativePV / cumulativeVolume;
  });
}