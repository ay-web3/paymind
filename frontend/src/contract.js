export const CONTRACT_ADDRESS = "0x236beE9674C34103db639B50ec62eD2166b837b6";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export const AGENT_MANAGER_ADDRESS = "0xdd45Cdaa2C3C0b51589B3A901383cd1B6B32fCB1";

export const ABI = [
  "function payForProduct(uint256 productId, string task, bytes32 receiptId)",
  "function productPrices(uint256) view returns (uint256)"
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export const AGENT_MANAGER_ABI = [
  "function createAgentWallet(uint256 dailyLimit) returns (address)",
  "function getMyAgent() view returns (address)",
  "function setDailyLimit(uint256 newLimit)",
  "function withdraw(uint256 amount)",

  // optional event
  "event AgentCreated(address indexed user, address agentWallet)"
];
