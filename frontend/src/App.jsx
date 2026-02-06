import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./trust.css";
import CoinGeckoDashboard from "./CoinGeckoDashboard";

import { searchProducts } from "./api/products";
import { PRODUCT_MAP } from "./productMap";
import { ensureArcNetwork } from "./network";
import CryptoChart from "./components/CryptoChart";

import {
  USDC_ADDRESS,
  USDC_ABI,
  AGENT_MANAGER_ADDRESS,
  AGENT_MANAGER_ABI,
} from "./contract";
import { getAgentOwner, ownerWithdrawUSDC } from "./onchain/agentWallet";
const API_BASE =
  "https://super-invention-qvp46rrwg67cxjvj-3000.app.github.dev";

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function App() {
  /* =====================
     Wallet / Agent
  ===================== */
  const [address, setAddress] = useState("");
  const [agentWallet, setAgentWallet] = useState("");
  const [agentBalance, setAgentBalance] = useState("0");
  const [dailyLimit, setDailyLimit] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawUsdcAmount, setWithdrawUsdcAmount] = useState("");
const [ownerCheck, setOwnerCheck] = useState(null);
const [withdrawTx, setWithdrawTx] = useState("");
  /* =====================
     Product + AI
  ===================== */
  const [view, setView] = useState("commerce");
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [task, setTask] = useState("Analyze profitability");
  const [customQuery, setCustomQuery] = useState("");

  const [analysis, setAnalysis] = useState("");
  const [txHash, setTxHash] = useState("");
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [intentResult, setIntentResult] = useState(null);
  const [cryptoCoin, setCryptoCoin] = useState("bitcoin");
  const [cryptoTf, setCryptoTf] = useState("1h");
  const [walletTab, setWalletTab] = useState("fund"); // "fund" | "withdraw"
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletAddress = address;
  const [trace, setTrace] = useState([]);
  /* =====================
     Wallet
  ===================== */

  async function connectWallet() {
    try {
      await ensureArcNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setAddress(await signer.getAddress());
    } catch (err) {
      alert("Wallet connection failed");
    }
  }
  async function resolveCoinId(coinQuery) {
  const q = String(coinQuery || "").trim();
  if (!q) return null;

  // Fast aliases for common tickers (prevents weird CoinGecko matches)
  const alias = {
    btc: "bitcoin",
    bitcoin: "bitcoin",
    eth: "ethereum",
    ethereum: "ethereum",
    sol: "solana",
    solana: "solana",
    bnb: "binancecoin",
    binance: "binancecoin",
  };

  const lower = q.toLowerCase();
  if (alias[lower]) return alias[lower];

  try {
    const res = await fetch(
      `${API_BASE}/crypto/resolve?query=${encodeURIComponent(q)}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data?.coinId ?? null;
  } catch (err) {
    console.warn("resolveCoinId failed:", err);
    return null;
  }
}
  function inferIntent(text) {
  const t = (text || "").toLowerCase().trim();

  // ─────────────────────────
  // CRYPTO INTENT
  // ─────────────────────────
  if (
    t.match(
      /\b(btc|bitcoin|eth|ethereum|sol|solana|bnb|binance|xrp|doge|ada|matic|avax|link|near|crypto|chart|price|rsi|vwap|ema)\b/
    )
  ) {
    // timeframe extraction
    const tf =
      t.match(/\b(1h|1d|7d)\b/)?.[1] ||
      (t.includes("daily")
        ? "1d"
        : t.includes("weekly")
        ? "7d"
        : "1h");

    // coin extraction (basic)
    const coinQuery =
  t.match(/\b(check|analyze|price|chart)\s+([a-z0-9\-]+)\b/)?.[2] ||
  t.match(/\b(btc|bitcoin|eth|ethereum|sol|solana|bnb|binance|xrp|doge|ada|matic|avax|link|near)\b/)?.[1] ||
  null;

return { type: "crypto", coinQuery, tf };
  }

  

  // ─────────────────────────
  // COMMERCE INTENT
  // ─────────────────────────
  if (
    t.match(
      /\b(product|profit|profitability|dropship|store|ads|marketing|sentiment|supplier)\b/
    )
  ) {
    const task =
      t.includes("sentiment")
        ? "Analyze sentiment"
        : t.includes("marketing")
        ? "Generate marketing ideas"
        : t.includes("custom") || t.includes("research")
        ? "Custom research"
        : "Analyze profitability";

    return {
      type: "commerce",
      task,
      productQuery: text
    };
  }

  // ─────────────────────────
  // UNKNOWN
  // ─────────────────────────
  return { type: "unknown" };
}
function copyWalletAddress() {
  if (!walletAddress) return;
  navigator.clipboard.writeText(walletAddress);
  alert("Address copied!");
}

function disconnectWallet() {
  // Metamask cannot be force-disconnected by dApps.
  // We "disconnect" by clearing app state.
  setWalletMenuOpen(false);

  setAddress("");
  setAgentWallet("");
  setAgentBalance("0");
  setOwnerCheck(null);
  setWithdrawTx("");

  // optional UI resets
  setSuggestions([]);
  setSelectedProductId(null);
  setSearchText("");
  setAnalysis("");
  setTxHash("");
  setStep("");
}

/* ✅ Close menu when clicking outside */
useEffect(() => {
  function onDocClick(e) {
    // only close if clicking outside the wallet pill/menu
    const el = e.target;
    if (!el.closest?.(".wallet-menu-wrap")) {
      setWalletMenuOpen(false);
    }
  }
  document.addEventListener("click", onDocClick);
  return () => document.removeEventListener("click", onDocClick);
}, []);
async function runIntent() {
  const intent = inferIntent(intentText);
  setIntentResult(intent);

  // ───────────────── CRYPTO ─────────────────
  if (intent.type === "crypto") {
  const coinId = await resolveCoinId(intent.coinQuery);

  if (!coinId) {
    alert("Coin not found. Try: BNB, XRP, NEAR, AVAX, etc.");
    return;
  }

  setCryptoCoin(coinId);
  setCryptoTf(intent.tf);
  setView("crypto");
  return;
}

  // ───────────────── COMMERCE ─────────────────
  if (intent.type === "commerce") {
    setView("commerce");
    setTask(intent.task);

    // Optional: auto search products from the intent text
    try {
      const ids = await searchProducts(intent.productQuery);
      setSuggestions(ids || []);

      if (ids?.length) {
        const firstId = ids[0];
        setSelectedProductId(firstId);
        setSearchText(productTitle(firstId));
      }
    } catch (e) {
      console.warn("Product auto-search failed:", e);
      setSuggestions([]);
    }

    return;
  }

  alert(
    "I’m not sure if this is Crypto or Commerce. Mention a coin (BTC/ETH) or a product task."
  );
}

  /* =====================
     Agent
  ===================== */
  const insufficientBalance =
  Number(withdrawUsdcAmount || 0) > Number(agentBalance || 0);

  async function loadAgentWallet() {
    if (!address) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const manager = new ethers.Contract(
      AGENT_MANAGER_ADDRESS,
      AGENT_MANAGER_ABI,
      signer
    );

    const agent = await manager.getMyAgent();

    if (agent && agent !== ethers.ZeroAddress) {
      setAgentWallet(agent);
      loadAgentBalance(agent);
    }

    const onChainOwner = await getAgentOwner(agent);
setOwnerCheck(onChainOwner.toLowerCase() === address.toLowerCase());
  }

  async function createAgentWallet() {
    try {
      setLoading(true);
      setStep("Creating AI Agent...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const manager = new ethers.Contract(
        AGENT_MANAGER_ADDRESS,
        AGENT_MANAGER_ABI,
        signer
      );

      const limit = ethers.parseUnits(dailyLimit, 6);
      const tx = await manager.createAgentWallet(limit);
      await tx.wait();

      await loadAgentWallet();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  async function loadAgentBalance(agentAddr) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const bal = await usdc.balanceOf(agentAddr);
    setAgentBalance(ethers.formatUnits(bal, 6));
  }

  async function fundAgent() {
    try {
      setLoading(true);
      setStep("Funding agent wallet...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const tx = await usdc.transfer(
        agentWallet,
        ethers.parseUnits(fundAmount, 6)
      );
      await tx.wait();

      await loadAgentBalance(agentWallet);
      setFundAmount("");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  async function handleOwnerWithdrawUSDC() {
  if (!address) return alert("Connect wallet");
  if (!agentWallet) return alert("No agent wallet");
  if (!withdrawUsdcAmount || Number(withdrawUsdcAmount) <= 0) {
    return alert("Enter USDC amount");
  }

  try {
    setLoading(true);
    setStep("Withdrawing USDC (owner)...");

    const txHash = await ownerWithdrawUSDC(
      agentWallet,
      address,
      withdrawUsdcAmount
    );

    setWithdrawTx(txHash);
    setWithdrawUsdcAmount("");

    await loadAgentBalance(agentWallet); // refresh USDC balance
    setStep("Withdraw complete ✅");
  } catch (e) {
    alert(e?.reason || e?.message || "Withdraw failed");
  } finally {
    setLoading(false);
    setTimeout(() => setStep(""), 1500);
  }
}

function productTitle(id) {
  return (
    PRODUCT_MAP?.[id] ||
    PRODUCT_MAP?.[Number(id)] ||
    `Product #${id}`
  );
}

  /* =====================
     Product Search
  ===================== */

  async function handleSearchChange(e) {
    const value = e.target.value;
    setSearchText(value);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    const ids = await searchProducts(value);
    setSuggestions(ids);
  }

  function selectProduct(id) {
  setSelectedProductId(id);
  setSearchText(productTitle(id));
  setSuggestions([]);
}

  /* =====================
     Buy & Analyze
  ===================== */

  async function buyAndAnalyze() {
  if (!selectedProductId) return alert("Select a product");
  if (!agentWallet) return alert("Create AI agent first");

  setLoading(true);
  setAnalysis("");
  setTxHash("");
  setTrace([]); // ✅ add this state: const [trace, setTrace] = useState([]);
  setStep("");

  
  const steps = [
    "Paying x402...",
    "Payment sent...",
    "Verifying payment...",
    "Fetching product data...",
    "Generating analysis...",
  ];

 
  if (!window.__buyAnalyzeRefs) window.__buyAnalyzeRefs = { cancel: { current: false }, timer: { current: null } };
  const buyCancelRef = window.__buyAnalyzeRefs.cancel;
  const buyTimerRef = window.__buyAnalyzeRefs.timer;

  // cancel any previous staged loop
  buyCancelRef.current = true;
  buyCancelRef.current = false;

  let idx = 0;

  const tick = () => {
    if (buyCancelRef.current) return;

    if (idx < steps.length) {
      setTrace((prev) => [...prev, { t: Date.now(), m: steps[idx] }]);
      idx += 1;
      buyTimerRef.current = setTimeout(tick, 700);
    }
  };

  tick();

  try {
    const res = await fetch(`${API_BASE}/ai-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProductId,
        task,
        mode: task,
        customQuery,
        userAddress: address,
      }),
    });

    const data = await res.json().catch(() => ({}));

    // ✅ Save txHash if provided (even if error)
    if (data?.txHash) {
      setTxHash(data.txHash);
      setTrace((prev) => [
        ...prev,
        { t: Date.now(), m: "Tx received. Verifying on-chain..." },
      ]);
    }

    // ✅ If your backend also returns trace like crypto endpoint, render it
    if (Array.isArray(data?.trace) && data.trace.length) {
      setTrace(data.trace);
    }

    if (!res.ok) throw new Error(data?.error || "AI failed");

    // stop staged steps
    buyCancelRef.current = true;
    if (buyTimerRef.current) clearTimeout(buyTimerRef.current);

    // If no server trace, finalize nicely
    if (!Array.isArray(data?.trace) || !data.trace.length) {
      setTrace((prev) => [...prev, { t: Date.now(), m: "Done." }]);
    }

    setAnalysis(
      typeof data.analysis === "string"
        ? data.analysis
        : JSON.stringify(data.analysis, null, 2)
    );

    setStep("Done");
  } catch (e) {
    buyCancelRef.current = true;
    if (buyTimerRef.current) clearTimeout(buyTimerRef.current);

    setTrace((prev) => [
      ...prev,
      { t: Date.now(), m: `Error: ${e?.message || "failed"}` },
    ]);

    alert(e?.message || "AI failed");
  } finally {
    setLoading(false);
    setTimeout(() => setStep(""), 1500);
  }
}


  useEffect(() => {
    if (address) loadAgentWallet();
  }, [address]);

  /* =====================
     UI
  ===================== */

  return (
  <>
    {/* NAVBAR */}
    <nav className="navbar">
      <div className="logo">
        PAY
        <span style={{ color: "var(--text-primary)" }}>MIND</span>
      </div>

      <div className="nav-links">
        <a
          onClick={() => setView("commerce")}
          className={view === "commerce" ? "active-link" : ""}
        >
          Commerce AI
        </a>
        <a
          onClick={() => setView("crypto")}
          className={view === "crypto" ? "active-link" : ""}
        >
          Crypto AI
        </a>
      </div>

      {!address ? (
  <button className="btn-glow" onClick={connectWallet}>
    Connect Wallet
  </button>
) : (
  <div className="wallet-menu-wrap" style={{ position: "relative" }}>
    <button
      type="button"
      className="wallet-pill"
      onClick={(e) => {
        e.stopPropagation();
        setWalletMenuOpen((v) => !v);
      }}
      style={{
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
      aria-haspopup="menu"
      aria-expanded={walletMenuOpen}
    >
      {shortAddr(address)}
      <span style={{ opacity: 0.7 }}>▾</span>
    </button>

    {walletMenuOpen && (
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 10px)",
          width: 220,
          background: "#0b1220",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          zIndex: 2000,
        }}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.65)",
            fontSize: 12,
          }}
        >
          Connected wallet
        </div>

        <button
          type="button"
          onClick={copyWalletAddress}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 12px",
            background: "transparent",
            border: "none",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
          role="menuitem"
        >
          Copy address
        </button>

        <button
          type="button"
          onClick={disconnectWallet}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 12px",
            background: "transparent",
            border: "none",
            color: "#fca5a5",
            cursor: "pointer",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
          role="menuitem"
        >
          Disconnect
        </button>
      </div>
    )}
  </div>
)}
    </nav>

    {/* HERO SECTION */}
    <section className="hero">
      <div className="hero-text">
        <span
          className="step-card"
          style={{ padding: "4px 12px", marginBottom: "12px" }}
        >
          <span>V1.0 ALPHA</span>
        </span>

        <h1>
          Autonomous Intelligence <br />
          <span style={{ color: "var(--cyan)" }}>That Pays and Executes</span>
        </h1>

        <p>
          Paymind deploys autonomous agents that analyze markets, manage capital,
          and execute on-chain actions using programmable wallets.
        </p>

        <div
          className="row"
          style={{ justifyContent: "flex-start", marginTop: "20px" }}
        >
          <button className="btn-glow" onClick={() => setView("commerce")}>
            🛒 Commerce AI
          </button>
          <button className="btn-glow" onClick={() => setView("crypto")}>
            📊 Crypto AI
          </button>
        </div>
      </div>

      <div className="hero-visual">
        <div className="agent-orb">🤖</div>
      </div>
    </section>

    {/* UNIVERSAL COMMAND BAR */}
    <div className="container" style={{ marginBottom: "40px" }}>
      <div className="glass-card">
        <div style={{ marginBottom: "12px" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
            Universal Agent Command
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Execute cross-functional tasks: "Analyze BTC 1h" or "red polish profitability"
          </p>
        </div>

        <div className="input-group">
          <input
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            placeholder="Enter agent command..."
            style={{ border: "none", background: "transparent" }}
          />
          <button
            className="btn-glow"
            onClick={runIntent}
            disabled={!intentText.trim()}
          >
            Run
          </button>
        </div>

        {intentResult?.type && intentResult.type !== "unknown" && (
          <div
            className="agent-balance"
            style={{ marginTop: "16px", background: "rgba(0,240,255,0.03)" }}
          >
            <span>Routing Status:</span>
            <b>{intentResult.type.toUpperCase()} NODE ACTIVE</b>
          </div>
        )}
      </div>
    </div>

    <section id="dashboard" style={{ paddingTop: 0 }}>
      <div className="container">
        {/* ===============================
   AI AGENT WALLET CARD
================================ */}
<div
  className="glass-card"
  style={{ marginBottom: "40px", padding: "0", overflow: "hidden" }}
>
  {/* HEADER — ALWAYS VISIBLE */}
  <div
    style={{
      padding: "20px 24px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
    onClick={() => setIsWalletOpen((prev) => !prev)}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <h3 style={{ margin: 0, fontSize: "1rem" }}>Agent Wallet Control</h3>

      {agentWallet ? (
        <span className="wallet-status-tag">Connected</span>
      ) : address ? (
        <span
          className="wallet-status-tag"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          Not created
        </span>
      ) : (
        <span
          className="wallet-status-tag"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          Disconnected
        </span>
      )}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {/* Wallet Address — copy only when agent exists */}
      {agentWallet && (
        <div
          className="addr-pill"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(agentWallet);
            alert("Agent address copied!");
          }}
          title="Copy agent wallet"
        >
          {shortAddr(agentWallet)}
          <span style={{ fontSize: "10px" }}>📋</span>
        </div>
      )}

      <span className={`chevron ${isWalletOpen ? "is-open" : ""}`}>▾</span>
    </div>
  </div>

  {/* COLLAPSIBLE BODY */}
  <div className={`collapsible-wrapper ${isWalletOpen ? "is-open" : ""}`}>
    <div style={{ padding: "0 24px 24px 24px" }}>
      {/* 1) No wallet connected */}
      {!address && (
        <div style={{ paddingTop: 4 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            Connect your wallet to create an agent wallet and manage funds.
          </p>
          <button className="btn-glow" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      )}

      {/* 2) Connected, but no agent wallet yet */}
      {address && !agentWallet && (
        <div style={{ paddingTop: 4 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            No agent wallet found for this address. Create one to continue.
          </p>

          <div className="input-group" style={{ maxWidth: 520 }}>
            <input
              placeholder="Daily limit (USDC), Note: can't be edited after this."
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />
            <button
              className="btn-glow"
              onClick={createAgentWallet}
              disabled={loading}
              style={{ whiteSpace: "nowrap" }}
            >
              {loading ? "Creating..." : "Create Agent"}
            </button>
          </div>

          {step && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
              ⏳ {step}
            </p>
          )}
        </div>
      )}

      {/* 3) Agent exists */}
      {address && agentWallet && (
        <>
          {/* BALANCE */}
          <div
            className="agent-balance"
            style={{ marginBottom: "20px", padding: "12px 16px" }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                display: "block",
              }}
            >
              Available Liquidity
            </span>

            <b className="balance-large" style={{ color: "var(--cyan)" }}>
              {agentBalance}{" "}
              <span style={{ fontSize: "0.8rem", color: "#fff", fontWeight: 400 }}>
                USDC
              </span>
            </b>
          </div>

          {/* ACTION AREA */}
          <div
            className="action-area"
            style={{
              background: "rgba(0,0,0,0.15)",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            <div className="wallet-tabs" style={{ marginBottom: 16, maxWidth: 400 }}>
              <button
                type="button"
                className={`wallet-tab ${walletTab === "fund" ? "active-fund" : ""}`}
                onClick={() => setWalletTab("fund")}
              >
                Fund
              </button>
              <button
                type="button"
                className={`wallet-tab ${
                  walletTab === "withdraw" ? "active-withdraw" : ""
                }`}
                onClick={() => setWalletTab("withdraw")}
              >
                Withdraw
              </button>
            </div>

            {walletTab === "fund" ? (
              <div className="input-group" style={{ maxWidth: 520 }}>
                <input
                  placeholder="0.00"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                />
                <button className="btn-glow" onClick={fundAgent} disabled={loading}>
                  {loading ? "Funding..." : "Deposit"}
                </button>
              </div>
            ) : (
              <>
                {ownerCheck === false && (
                  <p style={{ color: "#f59e0b", fontSize: 12, marginBottom: 10 }}>
                    ⚠️ You are not the on-chain owner. Withdraw will fail.
                  </p>
                )}

                <div className="input-group" style={{ maxWidth: 520 }}>
                  <input
                    placeholder="0.00"
                    value={withdrawUsdcAmount}
                    onChange={(e) => setWithdrawUsdcAmount(e.target.value)}
                  />

                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => setWithdrawUsdcAmount(String(agentBalance || "0"))}
                  >
                    MAX
                  </button>

                  <button
                    className="btn-glow"
                    onClick={handleOwnerWithdrawUSDC}
                    disabled={loading || insufficientBalance || ownerCheck === false}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {loading ? "Withdrawing..." : "Withdraw"}
                  </button>
                </div>

                {insufficientBalance && (
                  <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                    Insufficient USDC balance.
                  </p>
                )}

                {withdrawTx && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                    Withdraw Tx: {withdrawTx}
                  </p>
                )}
              </>
            )}
          </div>

          {step && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
              ⏳ {step}
            </p>
          )}
        </>
      )}
    </div>
  </div>
</div>



        {/* VIEW CONTENT */}
        {view === "commerce" ? (
          <div className="commerce-view animate-in">
            <h2 className="section-title">Commerce Intelligence</h2>

            <div className="glass-card">
              <div className="input-group" style={{ marginBottom: "12px" }}>
                <input
                  placeholder="Search Global Products..."
                  value={searchText}
                  onChange={handleSearchChange}
                />
              </div>

              {suggestions.length > 0 && (
                <div className="dashboard-mock" style={{ marginBottom: "20px" }}>
                  {suggestions.map((id) => (
                    <div
                      key={id}
                      className="table-row"
                      onClick={() => selectProduct(id)}
                    >
                      <span>{productTitle(id)}</span>
                      <span style={{ color: "var(--cyan)" }}>Select ›</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="row">
                <select value={task} onChange={(e) => setTask(e.target.value)}>
  <option>Analyze profitability</option>
  <option>Analyze sentiment</option>
  <option>Marketing strategy</option>
  <option>Custom research</option>
</select>

{task === "Custom research" && (
  <textarea
    value={customQuery}
    onChange={(e) => setCustomQuery(e.target.value)}
    placeholder='Type your custom research request... e.g. "Find best angles to sell this product in Nigeria"'
    rows={3}
    style={{
      width: "100%",
      marginTop: 12,
      background: "#020617",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: 12,
      color: "#fff",
      resize: "vertical",
    }}
  />
)}

                <button
  className="btn-glow btn-full"
  onClick={buyAndAnalyze}
  disabled={loading}
>
  {loading ? "Running Agent..." : "Execute Analysis"}
</button>
<div
  style={{
    marginTop: 12,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    padding: 12,
    maxHeight: 180,
    overflow: "auto",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 1.5,
    opacity: trace.length ? 1 : 0.6,
  }}
>
  {!trace.length ? (
    <div>Waiting...</div>
  ) : (
    trace.map((x, i) => (
      <div key={i}>
        
        {x?.m || ""}
      </div>
    ))
  )}
</div>

{/* ===============================
    Transaction Link
============================== */}
{txHash && (
  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
    Tx:&nbsp;
    <a
      href={`https://testnet.arcscan.app/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      style={{ color: "var(--cyan)" }}
    >
      Open in Explorer
    </a>
  </div>
)}
              </div>

              {analysis && (
                <div className="ai-result">
                  <div className="ai-result-head">
                    <span>Paymind Decision Output</span>
                    <button
                      className="btn-mini"
                      onClick={() => navigator.clipboard.writeText(analysis)}
                    >
                      Copy
                    </button>
                    
                  </div>
                  <pre className="ai-result-body">{analysis}</pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="crypto-view animate-in">
            <h2 className="section-title">Market Intelligence</h2>

            <CryptoChart
              key={`${cryptoCoin}-${cryptoTf}`}
              coin={cryptoCoin}
              initialTimeframe={cryptoTf}
            />

            <CoinGeckoDashboard userAddress={address} />
          </div>
        )}
      </div>
    </section>

    <footer className="footer">
      <div className="footer-inner">
        <div className="logo" style={{ fontSize: "0.9rem", marginBottom: "10px" }}>
          PayMind
        </div>
        <p>© 2026 Built for ARC Hackathon • Secured by Smart Contract</p>
      </div>
    </footer>
  </>
);
}