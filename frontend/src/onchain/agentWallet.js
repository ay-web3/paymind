import { ethers } from "ethers";
import { AGENT_WALLET_ABI } from "./agentWalletAbi";
import { USDC_ADDRESS } from "../contract";

export async function getAgentOwner(agentWalletAddress) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const wallet = new ethers.Contract(agentWalletAddress, AGENT_WALLET_ABI, provider);
  return await wallet.owner();
}

export async function ownerWithdrawUSDC(agentWalletAddress, toAddress, amountUsdc) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const wallet = new ethers.Contract(agentWalletAddress, AGENT_WALLET_ABI, signer);

  const amount = ethers.parseUnits(amountUsdc, 6); // USDC = 6 decimals
  const tx = await wallet.withdrawToken(USDC_ADDRESS, toAddress, amount);
  await tx.wait();

  return tx.hash;
}