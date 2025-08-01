import { ethers } from "hardhat";
import { getWallets } from "./utils";
import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main() {
  const hre = await import("hardhat");
  const [deployer, multisigSigner] = await getWallets(hre, 2);
  console.log("Safe transaction simulation with account:", deployer.address);

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
  const simulateTxAccessorAddress = deploymentAddresses["SimulateTxAccessor"];

  if (!gnosisSafeL2Address || !gnosisSafeProxyFactoryAddress || !compatibilityFallbackHandlerAddress || !simulateTxAccessorAddress) {
    console.error("Required contract addresses not found in deployment file");
    console.error("Available addresses:", Object.keys(deploymentAddresses));
    process.exit(1);
  }

  console.log("Loading contract instances from deployment addresses:");
  console.log("- GnosisSafeL2:", gnosisSafeL2Address);
  console.log("- GnosisSafeProxyFactory:", gnosisSafeProxyFactoryAddress);
  console.log("- CompatibilityFallbackHandler:", compatibilityFallbackHandlerAddress);
  console.log("- SimulateTxAccessor:", simulateTxAccessorAddress);

  // Get contract instances
  const gnosisSafeL2 = await ethers.getContractAt("GnosisSafeL2", gnosisSafeL2Address);
  const gnosisSafeProxyFactory = await ethers.getContractAt("GnosisSafeProxyFactory", gnosisSafeProxyFactoryAddress);
  const simulateTxAccessor = await ethers.getContractAt("SimulateTxAccessor", simulateTxAccessorAddress);

  // Create a Safe account if it doesn't exist
  const saltNonce = 1;
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
    console.log("Safe account created, tx hash:", receipt?.hash);

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


  // Transfer some ETH to Safe if needed
  const safeBalance = await ethers.provider.getBalance(safeAddress);
  if (safeBalance < ethers.parseEther("0.1")) {
    const tx2 = await deployer.sendTransaction({
      to: safeAddress,
      value: ethers.parseEther("1.0")
    });
    console.log("Transferred 1 ETH to Safe account, tx hash:", tx2.hash);
  } else {
    console.log("Safe account has sufficient balance:", ethers.formatEther(safeBalance), "ETH");
  }

  // Get Safe contract instance
  const gnosisSafeAccount = await ethers.getContractAt("GnosisSafe", safeAddress);
  
  const targetCallData = '0x';
  const operation = 0;

  const accessorAddress = deploymentAddresses["SimulateTxAccessor"];
  const accessor = await ethers.getContractAt("SimulateTxAccessor", accessorAddress);
  const accessorTxData = accessor.interface.encodeFunctionData(
      "simulate",
      [deployer.address, ethers.parseEther("0.12"), targetCallData, operation]
  );
  console.log("accessor.simulate tx:", accessorTxData);

  const CompatibilityFallbackHandler = await ethers.getContractFactory("CompatibilityFallbackHandler");
  const handler = await CompatibilityFallbackHandler.attach(safeAddress);
  const result = await (handler as any).simulate.staticCall(accessorAddress, accessorTxData);
  console.log("accessor.simulate result:", result);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });