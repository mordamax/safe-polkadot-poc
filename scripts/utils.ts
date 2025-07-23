import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, JsonRpcProvider } from "ethers";

/**
 * Get the keccak256 hash of contract bytecode
 * @param bytecode Contract bytecode
 * @returns keccak256 hash of the bytecode
 */
export function getCodeHash(bytecode: string): string {
  return ethers.keccak256(bytecode);
}

/**
 * Build deployment calldata
 * @param codeHash keccak256 hash of the contract bytecode
 * @param salt Optional salt
 * @returns deployment calldata
 */
export function buildDeployCalldata(codeHash: string, salt?: string): string {
  // Use provided salt or generate random salt
  const finalSalt = salt || ethers.keccak256(ethers.randomBytes(32));
  // Format: [salt (32 bytes)][bytecodeHash]
  return ethers.concat([finalSalt, codeHash]);
}

/**
 * Get n wallets from hardhat config
 * @param hre Hardhat runtime environment
 * @param n Number of wallets needed
 * @returns Array of wallets
 */
export function getWallets(hre: HardhatRuntimeEnvironment, n: number): Wallet[] {
  const provider = new JsonRpcProvider(hre.network.config.url);
  const allWallets = (hre.network.config.accounts as string[]).map(
    (account: string) => new Wallet(account, provider)
  );
  return allWallets.slice(0, n);
}