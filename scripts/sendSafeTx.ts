import { ethers } from "hardhat";
import { getWallets } from "./utils";
import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main() {
  const hre = await import("hardhat");
  const [deployer, multisigSigner] = await getWallets(hre, 2);
  console.log("Executing Safe transaction with account:", deployer.address);

  // Load deployment addresses
  const networkName = hre.network.name;
  const deploymentFile = path.join(__dirname, "..", "deployment", `${networkName}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file not found: ${deploymentFile}`);
    console.error("Please run deploy_all.ts first to deploy contracts");
    process.exit(1);
  }

  const deploymentAddresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  console.log("Loaded deployment addresses from:", deploymentFile);
  
  // Get contract addresses from deployment
  const gnosisSafeL2Address = deploymentAddresses["GnosisSafeL2"];
  const gnosisSafeProxyFactoryAddress = deploymentAddresses["GnosisSafeProxyFactory"];
  const compatibilityFallbackHandlerAddress = deploymentAddresses["CompatibilityFallbackHandler"];

  if (!gnosisSafeL2Address || !gnosisSafeProxyFactoryAddress || !compatibilityFallbackHandlerAddress) {
    console.error("Required contract addresses not found in deployment file");
    console.error("Available addresses:", Object.keys(deploymentAddresses));
    process.exit(1);
  }

  console.log("Loading contract instances from deployment addresses:");
  console.log("- GnosisSafeL2:", gnosisSafeL2Address);
  console.log("- GnosisSafeProxyFactory:", gnosisSafeProxyFactoryAddress);
  console.log("- CompatibilityFallbackHandler:", compatibilityFallbackHandlerAddress);

  // Get contract instances
  const gnosisSafeL2 = await ethers.getContractAt("GnosisSafeL2", gnosisSafeL2Address);
  const gnosisSafeProxyFactory = await ethers.getContractAt("GnosisSafeProxyFactory", gnosisSafeProxyFactoryAddress);

  const saltNonce = 42;

  const initCode = gnosisSafeL2.interface.encodeFunctionData("setup", [
    [
      deployer.address,
      multisigSigner.address
    ], // owners
    1, // threshold
    '0x0000000000000000000000000000000000000000', // to
    '0x', // data
    compatibilityFallbackHandlerAddress, // fallbackHandler
    '0x0000000000000000000000000000000000000000', // paymentToken
    0, // payment
    '0x0000000000000000000000000000000000000000' // paymentReceiver
  ]);

  const tx = await gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafeL2Address, initCode, saltNonce);
  const receipt = await tx.wait();
  
  // get safe account address from proxy creation event
  const proxyCreationEvent = receipt?.logs?.find((log: any) => {
    try {
      const parsedLog = gnosisSafeProxyFactory.interface.parseLog(log);
      return parsedLog && parsedLog.name === 'ProxyCreation';
    } catch {
      return false;
    }
  });
  
  const safeAddress = proxyCreationEvent ? 
    gnosisSafeProxyFactory.interface.parseLog(proxyCreationEvent)?.args.proxy : 
    null;
  
  console.log("Safe account Created at address:", safeAddress);

  // transfer 1ETH to safe account
  const tx2 = await deployer.sendTransaction({
    to: safeAddress,
    value: ethers.parseEther("1.0")
  });
  console.log("send 1ETH to safe account, tx hash:", tx2.hash);

  // 1. get GnosisSafe contract instance
  const gnosisSafeAccount = await ethers.getContractAt("GnosisSafe", safeAddress);
  
  // construct SafeTx
  const to = deployer.address;
  const value = ethers.parseEther("0.0123");
  const data = "0x"; //
  const operation = 0; // 0: CALL, 1: DELEGATECALL
  const safeTxGas = 0;
  const baseGas = 0;
  const gasPrice = 0;
  const gasToken = "0x0000000000000000000000000000000000000000";
  const refundReceiver = "0x0000000000000000000000000000000000000000";
  const nonce = await gnosisSafeAccount.nonce();
  
  // calc safe tx hash
  const safeTxHash = await gnosisSafeAccount.getTransactionHash(
    to,
    value,
    data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    nonce
  );
  console.log("Safe transaction hash:", safeTxHash);
  
  // 2. sign SafeTx
  const signature = await deployer.signMessage(ethers.getBytes(safeTxHash));
  console.log("Signature:", signature);
  
  // 3. send SafeTx
  const safeTx = await gnosisSafeAccount.execTransaction(
    to,
    value,
    data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    signature
  );
  const safeTxReceipt = await safeTx.wait();
  console.log("Safe transaction executed, tx hash:", safeTxReceipt?.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });