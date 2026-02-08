export const CONTRACT_ADDRESS = "0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export const AGENT_MANAGER_ADDRESS = "0x65b685fCF501D085C80f0D99CFA883cFF3445ff2";

export const ABI = [
  "function payForProduct(uint256 productId, string task, bytes32 receiptId)",
  "function productPrices(uint256) view returns (uint256)"
];

export const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export const AGENT_MANAGER_ABI = [
  "function createAgentWallet(uint256 dailyLimit) returns (address)",
  "function getMyAgent() view returns (address)",
  "function setDailyLimit(uint256 newLimit)",
  "function withdraw(uint256 amount)",
  "function userToAgent(address) view returns (address)",

  // optional event
  "event AgentCreated(address indexed user, address agentWallet)"
];
