import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { analyzeMarketStructure } from "./services/marketStructure.js";
import { ethers } from "ethers";
import fs from "fs";
import fetch from "node-fetch";
import cors from "cors";
import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import { resolvePreset } from "./coin/cryptoPresets.js";
import {
  indexProducts,
  findProductIdsFromText,
  findBestProductId
} from "./productRegistry.js";
import { getCoinPrice, searchCoin } from "./services/coingecko.js";
import { loadMemeCoins } from "./coin/loadMemeCoins.js";
import { setMemeCoins } from "./coin/presets.js";
import { MEME_COINS } from "./coin/presets.js";
import { getMultiCoinPricesLarge } from "./services/coingecko.js";
import {
  getMarketChart,
  getMarketCandles,
  getLivePrice
} from "./services/cryptoChart.js";
import { calculateSupportResistance, detectTrend } from "./services/technicalAnalysis.js";
import {
  calculateEMA,
  calculateRSI,
  calculateVWAP
} from "./services/indicators.js";
import {
  calculateZonesFromVolume,
  rankZonesByStrength
} from "./services/zoneAnalysis.js";
import { generateAIExplanation } from "./services/aiExplanation.js";

const USDC_ADDRESS = process.env.USDC_ADDRESS;




/* =======================
   CONFIG
======================= */
const PRODUCT_PRICE = "0.001";
const PORT = 3000;
const ARC_RPC_URL = "https://rpc.testnet.arc.network";

const X402_CONTRACT_ADDRESS = "0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6";
const AGENT_MANAGER_ADDRESS = process.env.AGENT_MANAGER_ADDRESS;

console.log("X402_CONTRACT_ADDRESS:", X402_CONTRACT_ADDRESS);
console.log("USDC_ADDRESS:", process.env.USDC_ADDRESS);
console.log("AGENT_MANAGER_ADDRESS:", AGENT_MANAGER_ADDRESS);

/* =======================
   BLOCKCHAIN
======================= */

const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log("Backend signer address:", await signer.getAddress());
const agentProvider = new ethers.JsonRpcProvider(ARC_RPC_URL);



const agentSigner = new ethers.Wallet(
  process.env.AGENT_PRIVATE_KEY,
  agentProvider
);
const AGENT_MANAGER_ABI = [
  "function userToAgent(address) view returns (address)"
];

const AGENT_WALLET_ABI = [
  "function execute(address target,uint256 value,bytes data,uint256 amountUSDC)"
];

const X402_ABI = [
  "function pay(uint256 datasetId)"
];
const agenticCommerce = new ethers.Contract(
  X402_CONTRACT_ADDRESS,
  [
    "function payForProduct(uint256 productId, string task, bytes32 receiptId)",
  ],
  agentSigner
);


/* =======================
   PRODUCT CACHE
======================= */

let PRODUCT_CACHE = [];
let PRODUCT_MAP = {};

async function fetchAllProducts() {
  let all = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`https://dummyjson.com/products?limit=${limit}&skip=${skip}`);
    const data = await res.json();

    all.push(...data.products);
    if (data.products.length < limit) break;
    skip += limit;
  }
  return all;
}

async function ensureApproval(agentWalletAddress, priceUSDC) {
  const iface = new ethers.Interface([
    "function approve(address,uint256)"
  ]);

  const amount = ethers.parseUnits("1000000", 6);

  const calldata = iface.encodeFunctionData("approve", [
    X402_CONTRACT_ADDRESS,
    amount
  ]);

  const managerWrite = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    ["function executeFromAgent(address,address,uint256,bytes,uint256)"],
    signer
  );

  const tx = await managerWrite.executeFromAgent(
    agentWalletAddress,
    USDC_ADDRESS,
    0,
    calldata,
    0
  );

  await tx.wait();
}


async function initProducts() {
  PRODUCT_CACHE = await fetchAllProducts();
  PRODUCT_MAP = {};
  for (const p of PRODUCT_CACHE) PRODUCT_MAP[p.id] = p.title;
  console.log(`✅ Loaded ${PRODUCT_CACHE.length} products`);
}
async function agentPayForAccess(userAddress, productId, task, priceUSDC) {

  const managerRead = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    AGENT_MANAGER_ABI,
    provider
  );

  const agentWalletAddress = await managerRead.userToAgent(userAddress);
  if (agentWalletAddress === ethers.ZeroAddress) {
    throw new Error("User has no agent wallet");
  }

  const iface = new ethers.Interface([
    "function payForProduct(uint256,string,bytes32)"
  ]);

  const receiptId = ethers.id(Date.now().toString());

  const calldata = iface.encodeFunctionData("payForProduct", [
    productId,
    task,
    receiptId
  ]);

  const managerWrite = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    ["function executeFromAgent(address,address,uint256,bytes,uint256)"],
    signer
  );

  const price = ethers.parseUnits(priceUSDC.toString(), 6);

  // ✅ 1. Agent approves USDC
  await ensureApproval(agentWalletAddress);

  // ✅ 2. Agent pays X402 contract
  const tx = await managerWrite.executeFromAgent(
    agentWalletAddress,
    X402_CONTRACT_ADDRESS,
    0,
    calldata,
    price
  );

  await tx.wait();

  return tx.hash;
}



/* =======================
   GEMINI
======================= */

const auth = new GoogleAuth({
  credentials: JSON.parse(fs.readFileSync("./secrets/gemini-sa.json", "utf8")),
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/generative-language"
  ],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function callGemini(prompt) {
  const token = await getAccessToken();

  const PROJECT_ID = "my-project-ay-63015";
  const LOCATION = "us-central1";

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash-001:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();
  if (!data.candidates) throw new Error("Gemini failed");

  return data.candidates[0].content.parts[0].text;
}

async function initMemeCoins() {
  const coins = await loadMemeCoins(300);
  setMemeCoins(coins);
  console.log("✅ Loaded meme coins:", coins.length);
}

await initMemeCoins();

/* =======================
   EXPRESS
======================= */

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => res.send("Agentic Commerce AI API running"));


/* =======================
   AGENT ON-CHAIN PAYMENT
======================= */


/* =======================
   LIVE PRICE (NO x402)
======================= */

app.get("/crypto/live-price", async (req, res) => {
  try {
    const coin = req.query.coin || "ethereum";
    const price = await getCoinPrice(coin);

    res.json({
      coin,
      price
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =======================
   X402 VERIFICATION
======================= */

async function verifyContractPayment(txHash, expectedId, minAmount) {
  const receipt = await provider.waitForTransaction(txHash, 1);
  if (!receipt || receipt.status !== 1) return false;

  const iface = new ethers.Interface([
    "event ProductPaid(address indexed buyer, uint256 indexed productId, uint256 amount)"
  ]);

  const expectedAmount = ethers.parseUnits(minAmount.toString(), 6);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);

      if (parsed.name !== "ProductPaid") continue;

      const productId = parsed.args.productId;
      const amount = parsed.args.amount;

      console.log("FOUND EVENT:", {
        productId: productId.toString(),
        amount: amount.toString()
      });

      if (
        productId.toString() === expectedId.toString() &&
        amount >= expectedAmount
      ) {
        return true;
      }

    } catch {}
  }

  return false;
}


/* =======================
   PAID DATASET
======================= */

app.get("/dataset", async (req, res) => {
  let payment;
  try {
    payment = JSON.parse(req.headers["x-payment"]);
  } catch {
    return res.status(402).json({ error: "Invalid payment header" });
  }

  const valid = await verifyContractPayment(payment.txHash, payment.datasetId, payment.amount);
  if (!valid) return res.status(402).json({ error: "Payment not verified" });

  const data = await fetch(`https://dummyjson.com/products/${payment.datasetId}`).then(r => r.json());
  res.json(data);
});

app.get("/search-product", (req, res) => {
  const q = req.query.q || "";

  if (!q.trim()) {
    return res.status(400).json({ error: "Missing query param q" });
  }

  const ids = findProductIdsFromText(q);

  res.json({
    query: q,
    ids
  });
});



app.post("/analysis", async (req, res) => {
  try {
    const { userAddress, coin = "bitcoin", tf = "1h" } = req.body;

    if (!userAddress) {
      return res.status(400).json({ error: "Missing userAddress" });
    }

    /* ──────────────────────────────
       1️⃣ FETCH MARKET DATA
    ────────────────────────────── */
    const rawCandles = await getMarketCandles(coin, tf);
const { limit } = getTfConfig(tf);

if (!rawCandles || rawCandles.length < 60) {
  return res.status(400).json({
    error: "Insufficient candle data for analysis"
  });
}

const MAX_CANDLES = Math.min(limit, rawCandles.length);
let candles = rawCandles.slice(-MAX_CANDLES);

    /* ──────────────────────────────
       2️⃣ LIVE PRICE INJECTION (BEFORE INDICATORS)
    ────────────────────────────── */
    const livePrice = await getLivePrice(coin);
    const lastIndex = candles.length - 1;
    const last = candles[lastIndex];

    candles[lastIndex] = {
      ...last,
      c: livePrice,
      h: Math.max(last.h, livePrice),
      l: Math.min(last.l, livePrice)
    };

    const tfClose = livePrice;

    /* ──────────────────────────────
       3️⃣ INDICATORS (SERIES)
    ────────────────────────────── */
    const closes = candles.map(c => c.c);
    const ema50Series = calculateEMA(candles, 50);
    const rsiSeries = calculateRSI(closes, 14);
    const vwapSeries = calculateVWAP(candles);

    const ema50 = ema50Series.at(-1);
    


const validRSI = rsiSeries.filter(v => Number.isFinite(v));
if (!validRSI.length) {
  throw new Error("RSI calculation failed");
}

const rsi = validRSI.at(-1);
    const vwap = vwapSeries.at(-1);

    
    /* ──────────────────────────────
       4️⃣ PAYMENT (x402)
    ────────────────────────────── */
    const PRODUCT_ID = 4;
    const PRICE = "0.001";

    const txHash = await agentPayForAccess(
      userAddress,
      PRODUCT_ID,
      `market-analysis:${coin}:${tf}`,
      PRICE
    );

    const isValid = await verifyContractPayment(
      txHash,
      PRODUCT_ID,
      PRICE
    );

    if (!isValid) {
      return res.status(402).json({ error: "Payment verification failed" });
    }

    /* ──────────────────────────────
       5️⃣ STRUCTURE + ZONES
    ────────────────────────────── */
    const structure = analyzeMarketStructure(candles);

    const rawZones = calculateZonesFromVolume(candles);
    const rankedZones = rankZonesByStrength(rawZones, candles);

    const normalizedZones = rankedZones.map(z => ({
      ...z,
      type: z.high < tfClose ? "support" : "resistance"
    }));

    const price = livePrice;

const emaValue = ema50;
const vwapValue = vwap;

const distanceToEMA =
  emaValue ? ((price - emaValue) / emaValue) * 100 : 0;

const distanceToVWAP =
  vwapValue ? ((price - vwapValue) / vwapValue) * 100 : 0;
    const rsiState =
  rsi > 60 ? "strong" :
  rsi < 40 ? "weak" :
  "neutral";

  const nearestZone = normalizedZones
  .map(z => ({
    ...z,
    distancePct: ((livePrice - z.low) / livePrice) * 100
  }))
  .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];

    /* ──────────────────────────────
       6️⃣ AI EXPLANATION
    ────────────────────────────── */
    const aiExplanation = generateAIExplanation({
  coin,
  timeframe: tf,
  structure,

  zones: normalizedZones,
  nearestZone,

  ema: {
    value: emaValue,
    distancePct: distanceToEMA
  },

  vwap: {
    value: vwapValue,
    distancePct: distanceToVWAP
  },

  rsi: {
    value: Number(rsi.toFixed(1)),
    state: rsiState
  },

  price
});

    /* ──────────────────────────────
       7️⃣ RESPONSE
    ────────────────────────────── */
    res.json({
      paid: true,
      txHash,
      coin,
      timeframe: tf,
      prices: {
        live: livePrice,
        tfClose
      },
      analysis: {
        structure,
        zones: normalizedZones,

        ema50,
        ema50Series,

        vwap,
        vwapSeries,

        rsi,
        rsiSeries,

        explanation: aiExplanation
      }
    });

  } catch (err) {
    console.error("Paid analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/prices/meme-coins", async (req, res) => {
  try {
    const data = await getMultiCoinPricesLarge(MEME_COINS);
    res.json({
      count: MEME_COINS.length,
      data
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch meme coins" });
  }
});


/* =======================
   PRODUCT PICKER
======================= */

app.post("/pick-product", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const productId = findBestProductId(prompt) || 1;

  res.json({ productId });
});

app.post("/crypto/preset", async (req, res) => {
  try {
    const { preset, userCoins, limit } = req.body;

    const result = await resolvePreset({
      preset,
      userCoins,
      limit
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/crypto/chart/:coinId", async (req, res) => {
  try {
    const { coinId } = req.params;

    const prices = await getMarketChart(coinId, 7);

    const { support, resistance } = calculateSupportResistance(prices);
    const trend = detectTrend(prices);

    res.json({
      coinId,
      prices,
      support,
      resistance,
      trend
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



function getTfConfig(tf) {
  switch (tf) {
    case "1h":
      return {
        interval: "1h",
        limit: 400   // 👈 THIS FIXES THE SCANTY CHART
      };

    case "1d":
      return {
        interval: "1d",
        limit: 180
      };

    case "7d":
      return {
        interval: "1d",
        limit: 110
      };

    default:
      return {
        interval: "1h",
        limit: 100
      };
  }
}

app.get("/crypto/chart", async (req, res) => {
  try {
    const coin = req.query.coin || "bitcoin";
    const tf = req.query.tf || "1h";

    const { limit } = getTfConfig(tf);

    // Fetch raw candles
    const rawCandles = await getMarketCandles(coin, tf);

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return res.status(400).json({ error: "No candle data" });
    }

    // 🔑 Keep only the most recent candles for this timeframe
    const candles = rawCandles.slice(-limit);

    const closes = candles.map(c => c.c);

    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const rsi = calculateRSI(closes, 14);

    return res.json({
      candles,
      ema20,
      ema50,
      rsi
    });
  } catch (err) {
    console.error("Crypto chart error:", err);
    return res.status(500).json({ error: err.message });
  }
});



app.get("/crypto/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase();
    const preset = req.query.preset || "coins";

    if (!q) return res.json({ coins: [] });

    let coins = [];

    if (preset === "coins") {
      coins = await getTopCoins(22);
    } 
    else if (preset === "meme_coins") {
      coins = MEME_COINS;
    } 
    else {
      // user_custom → all coins
      coins = await searchCoin(q); // existing CoinGecko search
    }

    const filtered = coins
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
      )
      .slice(0, 8);

    res.json({ coins: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



/* =======================
   AI ANALYSIS
======================= */

app.post("/ai-query", async (req, res) => {
  try {
    const { productId, task, userAddress, mode, customQuery } = req.body;

    if (!productId || !userAddress) {
      return res.status(400).json({ error: "Missing productId or userAddress" });
    }

    const finalMode = mode || task || "analysis";

    if (finalMode === "Custom research" && (!customQuery || !customQuery.trim())) {
      return res.status(400).json({ error: "Custom research query is empty" });
    }

    // 1. Pay
    const txHash = await agentPayForAccess(
      userAddress,
      productId,
      finalMode,
      PRODUCT_PRICE
    );

    // 2. Verify
    const isValid = await verifyContractPayment(txHash, productId, PRODUCT_PRICE);
    if (!isValid) return res.status(402).json({ error: "Payment failed" });

    // 3. Load data
    const product = await fetch(
      `https://dummyjson.com/products/${productId}`
    ).then(r => r.json());

    const comments = await fetch(
      `https://dummyjson.com/comments?limit=20`
    ).then(r => r.json());

    // 4. Build prompt
    let prompt = "";

    if (finalMode === "Analyze profitability") {
      prompt = `
Give a short profitability analysis.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Analyze sentiment") {
      prompt = `
Analyze customer sentiment and risks.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Generate marketing ideas") {
      prompt = `
Generate marketing ideas for this product.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Custom research") {
      prompt = `
User custom request:
${customQuery}

Rules:
- Use ONLY the product data
- Be concise
- No filler

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else {
      prompt = `
User task: ${finalMode}

Product:
${JSON.stringify(product, null, 2)}
`;
    }

    // 5. AI
    const analysis = await callGemini(prompt);

    res.json({
      txHash,
      productId,
      mode: finalMode,
      analysis
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "AI failed" });
  }
});


app.get("/price/:coin", async (req, res) => {  
  try {  
    const coinId = req.params.coin.toLowerCase();  
    const price = await getCoinPrice(coinId);  
  
    res.json({  
      coin: coinId,  
      usd: price  
    });  
  } catch (err) {  
    res.status(400).json({ error: err.message });  
  }  
});  

app.post("/ai/crypto-analyze", async (req, res) => {
  try {
    const { userAddress, coinId, mode, preset, portfolio, customQuery } = req.body;

    if (!userAddress) {
      return res.status(400).json({ error: "Missing userAddress" });
    }

    if (!coinId && mode !== "portfolio") {
      return res.status(400).json({ error: "coinId required" });
    }

    // 1️⃣ Charge user via x402
    const PRODUCT_ID = 3; // virtual product id for crypto AI

    const txHash = await agentPayForAccess(
      userAddress,
      PRODUCT_ID,
      `crypto:${mode}`,
      PRODUCT_PRICE
    );

    // 2️⃣ Verify payment
    const isValid = await verifyContractPayment(txHash, PRODUCT_ID, PRODUCT_PRICE);
    if (!isValid) {
      return res.status(402).json({ error: "Payment failed" });
    }

    // 3️⃣ Build crypto data
    let context = "";

    if (mode === "portfolio") {
      context = `Portfolio coins: ${portfolio.join(", ")}`;
    } else {
      const price = await getCoinPrice(coinId);
      context = `Coin: ${coinId}, Current price: $${price}`;
    }

    const prompt = `
You are a professional crypto analyst.

Mode: ${mode}

${context}

${customQuery ? "User request: " + customQuery : ""}

Be concise and actionable.
`;

    // 4️⃣ AI
    const analysis = await callGemini(prompt);

    res.json({
      txHash,
      analysis
    });
  } catch (err) {
    console.error("Crypto AI error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   EXTRA AI ENDPOINTS 
======================= */

app.post("/ai-profit-check", async (req, res) => {
  const { productId } = req.body;

  const product = await fetch(`https://dummyjson.com/products/${productId}`).then(r => r.json());

  const prompt = `
You are a dropshipping analyst.

Return JSON:

{
  "costPrice": number,
  "sellPrice": number,
  "adsCost": number,
  "shipping": number,
  "profit": number,
  "marginPercent": number,
  "verdict": "good | risky | bad"
}

Product:
${JSON.stringify(product, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-sentiment", async (req, res) => {
  const comments = await fetch("https://dummyjson.com/comments?limit=30").then(r => r.json());

  const prompt = `
Analyze customer sentiment and risk.

Return JSON:

{
  "score": 0-100,
  "riskLevel": "low | medium | high",
  "commonComplaints": [],
  "summary": ""
}

Comments:
${JSON.stringify(comments.comments, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-cart", async (req, res) => {
  const { budget } = req.body;

  const products = PRODUCT_CACHE.slice(0, 50).map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category
  }));

  const prompt = `
Select products to build a cart under $${budget}.

Return JSON:

{
  "items": [{ "id": number, "qty": number }],
  "total": number,
  "reasoning": "..."
}

Products:
${JSON.stringify(products, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json({ cart: JSON.parse(ai) });
});


app.post("/ai-users-persona", async (req, res) => {
  const users = await fetch("https://dummyjson.com/users?limit=50").then(r => r.json());

  const prompt = `
You are a marketing analyst.

Build 3 buyer personas.

Return JSON:
[
  {
    "name": "",
    "ageRange": "",
    "interests": [],
    "buyingBehavior": "",
    "recommendedProducts": []
  }
]

Users:
${JSON.stringify(users.users, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-marketing-content", async (req, res) => {
  const { productName } = req.body;

  const posts = await fetch("https://dummyjson.com/posts?limit=50").then(r => r.json());

  const prompt = `
Generate marketing copy for product "${productName}".

Return JSON:
{
  "headline": "",
  "shortAd": "",
  "longDescription": "",
  "cta": ""
}

Posts style reference:
${JSON.stringify(posts.posts.slice(0, 10), null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-business-tasks", async (req, res) => {
  const { businessType } = req.body;

  const todos = await fetch("https://dummyjson.com/todos?limit=50").then(r => r.json());

  const prompt = `
You are an ecommerce operations manager.

Create a task plan for: ${businessType}

Return JSON:
{
  "today": [],
  "thisWeek": [],
  "automationCandidates": []
}

Reference tasks:
${JSON.stringify(todos.todos, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-meal-planner", async (req, res) => {
  const { diet } = req.body;

  const recipes = await fetch("https://dummyjson.com/recipes?limit=50").then(r => r.json());

  const prompt = `
Create a 3-day meal plan for diet: ${diet}

Return JSON:
{
  "day1": [],
  "day2": [],
  "day3": [],
  "shoppingList": []
}

Recipes:
${JSON.stringify(recipes.recipes.slice(0, 20), null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


/* =======================
   START
======================= */

/* =======================
   START (DEBUG VERSION)
======================= */

(async () => {
  console.log("Step 1: Starting initProducts...");

  try {
    await initProducts();
    console.log("Step 2: Products initialized. Indexing...");

    indexProducts(PRODUCT_CACHE);

    console.log("Step 3: Starting Express on PORT", PORT);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server finally running on ${PORT}`);
    });

    server.on("error", e => {
      console.error("EXPRESS SERVER ERROR:", e);
    });
  } catch (error) {
    console.error("❌ CRASHED DURING STARTUP:", error);
    process.exit(1);
  }
})();
