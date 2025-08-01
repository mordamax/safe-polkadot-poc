import { ethers } from "hardhat";
import { getCodeHash, buildDeployCalldata, getWallets } from "./utils";
import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main() {
  const hre = await import("hardhat");
  const [deployer, multisigSigner] = await getWallets(hre, 2);
  console.log("Deploying contracts with the account:", deployer.address);

  // Create deployment directory if it doesn't exist
  const deploymentDir = path.join(__dirname, "..", "deployment");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  // Initialize deployment addresses object
  const deploymentAddresses: { [key: string]: string } = {};

  // 1. Deploy DeterministicDeploymentProxy
  const proxyBytecode = fs.readFileSync(path.join(__dirname, "..", "output", "bytecode.txt"), "utf8").trim();
  const DeterministicDeploymentProxy = new ethers.ContractFactory([], proxyBytecode, deployer);
  const proxy = await DeterministicDeploymentProxy.deploy();
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("DeterministicDeploymentProxy deployed to:", proxyAddress);
  deploymentAddresses["DeterministicDeploymentProxy"] = proxyAddress;

  // 2. Deploy Libraries
  const CreateCall = await ethers.getContractFactory("CreateCall");
  const createCall = await CreateCall.deploy();
  await createCall.waitForDeployment();
  const createCallAddress = await createCall.getAddress();
  console.log("CreateCall deployed to:", createCallAddress);
  deploymentAddresses["CreateCall"] = createCallAddress;

  const MultiSend = await ethers.getContractFactory("MultiSend");
  const multiSend = await MultiSend.deploy();
  await multiSend.waitForDeployment();
  const multiSendAddress = await multiSend.getAddress();
  console.log("MultiSend deployed to:", multiSendAddress);
  deploymentAddresses["MultiSend"] = multiSendAddress;

  const MultiSendCallOnly = await ethers.getContractFactory("MultiSendCallOnly");
  const multiSendCallOnly = await MultiSendCallOnly.deploy();
  await multiSendCallOnly.waitForDeployment();
  const multiSendCallOnlyAddress = await multiSendCallOnly.getAddress();
  console.log("MultiSendCallOnly deployed to:", multiSendCallOnlyAddress);
  deploymentAddresses["MultiSendCallOnly"] = multiSendCallOnlyAddress;

  // 3. Deploy Handlers
  const DefaultCallbackHandler = await ethers.getContractFactory("DefaultCallbackHandler");
  const defaultCallbackHandler = await DefaultCallbackHandler.deploy();
  await defaultCallbackHandler.waitForDeployment();
  const defaultCallbackHandlerAddress = await defaultCallbackHandler.getAddress();
  console.log("DefaultCallbackHandler deployed to:", defaultCallbackHandlerAddress);
  deploymentAddresses["DefaultCallbackHandler"] = defaultCallbackHandlerAddress;

  const CompatibilityFallbackHandler = await ethers.getContractFactory("CompatibilityFallbackHandler");
  const compatibilityFallbackHandler = await CompatibilityFallbackHandler.deploy();
  await compatibilityFallbackHandler.waitForDeployment();
  const compatibilityFallbackHandlerAddress = await compatibilityFallbackHandler.getAddress();
  console.log("CompatibilityFallbackHandler deployed to:", compatibilityFallbackHandlerAddress);
  deploymentAddresses["CompatibilityFallbackHandler"] = compatibilityFallbackHandlerAddress;

  // 4. Deploy Safe Singleton (to upload code)
  const GnosisSafe = await ethers.getContractFactory("GnosisSafe", deployer);
  const gnosisSafe = await GnosisSafe.deploy();
  await gnosisSafe.waitForDeployment();
  const gnosisSafeInitialAddress = await gnosisSafe.getAddress();
  deploymentAddresses["GnosisSafe_Initial"] = gnosisSafeInitialAddress;
  const gnosisSafeBytecode = await gnosisSafe.getDeployedCode();
  if (!gnosisSafeBytecode) throw new Error("Failed to get GnosisSafe bytecode");
  const gnosisSafeBytecodeHash = ethers.keccak256(gnosisSafeBytecode);

  // 5. Deploy SafeL2 (to upload code)
  const GnosisSafeL2 = await ethers.getContractFactory("GnosisSafeL2", deployer);
  const gnosisSafeL2 = await GnosisSafeL2.deploy();
  await gnosisSafeL2.waitForDeployment();
  const gnosisSafeL2InitialAddress = await gnosisSafeL2.getAddress();
  deploymentAddresses["GnosisSafeL2_Initial"] = gnosisSafeL2InitialAddress;
  const gnosisSafeL2Bytecode = await gnosisSafeL2.getDeployedCode();
  if (!gnosisSafeL2Bytecode) throw new Error("Failed to get GnosisSafeL2 bytecode");
  const gnosisSafeL2BytecodeHash = ethers.keccak256(gnosisSafeL2Bytecode);

  // 6. Deploy Safe Proxy Factory
  const GnosisSafeProxyFactory = await ethers.getContractFactory("GnosisSafeProxyFactory", deployer);
  const gnosisSafeProxyFactory = await GnosisSafeProxyFactory.deploy();
  await gnosisSafeProxyFactory.waitForDeployment();
  const gnosisSafeProxyFactoryInitialAddress = await gnosisSafeProxyFactory.getAddress();
  deploymentAddresses["GnosisSafeProxyFactory_Initial"] = gnosisSafeProxyFactoryInitialAddress;
  const gnosisSafeProxyFactoryBytecode = await gnosisSafeProxyFactory.getDeployedCode();
  if (!gnosisSafeProxyFactoryBytecode) throw new Error("Failed to get GnosisSafeProxyFactory bytecode");
  const gnosisSafeProxyFactoryBytecodeHash = ethers.keccak256(gnosisSafeProxyFactoryBytecode);

  // 7. Deploy SafeProxy
  const SafeProxy = await ethers.getContractFactory("GnosisSafeProxy");
  const safeProxy = await SafeProxy.deploy(await gnosisSafe.getAddress());
  await safeProxy.waitForDeployment();

  // 8. Deploy Accessors
  const SimulateTxAccessor = await ethers.getContractFactory("SimulateTxAccessor");
  const simulateTxAccessor = await SimulateTxAccessor.deploy();
  await simulateTxAccessor.waitForDeployment();
  const simulateTxAccessorAddress = await simulateTxAccessor.getAddress();
  console.log("SimulateTxAccessor deployed to:", simulateTxAccessorAddress);
  deploymentAddresses["SimulateTxAccessor"] = simulateTxAccessorAddress;

  // 9. Redeploy Safe contracts through DeterministicDeploymentProxy
  console.log("\nDeploying Safe contracts through DeterministicDeploymentProxy...");

  
  // Deploy GnosisSafe
  const gnosisSafeSalt = ethers.keccak256(ethers.toUtf8Bytes("GnosisSafe"));
  const gnosisSafeCalldata = buildDeployCalldata(gnosisSafeBytecodeHash, gnosisSafeSalt);
  const gnosisSafeTx = await deployer.sendTransaction({
    to: proxyAddress,
    data: gnosisSafeCalldata,
    value: 0
  });
  const gnosisSafeReceipt = await gnosisSafeTx.wait();
  if (!gnosisSafeReceipt) throw new Error("GnosisSafe deployment failed");
  const gnosisSafeAddress = ethers.getCreate2Address(
    proxyAddress,
    gnosisSafeSalt,
    gnosisSafeBytecodeHash
  );
  console.log("GnosisSafe deterministic deployment transaction:", gnosisSafeReceipt.hash);
  console.log("GnosisSafe deterministic address:", gnosisSafeAddress);
  deploymentAddresses["GnosisSafe"] = gnosisSafeAddress;

  // Deploy GnosisSafeL2
  const gnosisSafeL2Salt = ethers.keccak256(ethers.toUtf8Bytes("GnosisSafeL2"));
  const gnosisSafeL2Calldata = buildDeployCalldata(gnosisSafeL2BytecodeHash, gnosisSafeL2Salt);
  const gnosisSafeL2Tx = await deployer.sendTransaction({
    to: proxyAddress,
    data: gnosisSafeL2Calldata,
    value: 0
  });
  const gnosisSafeL2Receipt = await gnosisSafeL2Tx.wait();
  if (!gnosisSafeL2Receipt) throw new Error("GnosisSafeL2 deployment failed");
  const gnosisSafeL2Address = ethers.getCreate2Address(
    proxyAddress,
    gnosisSafeL2Salt,
    gnosisSafeL2BytecodeHash
  );
  console.log("GnosisSafeL2 deterministic deployment transaction:", gnosisSafeL2Receipt.hash);
  console.log("GnosisSafeL2 deterministic address:", gnosisSafeL2Address);
  deploymentAddresses["GnosisSafeL2"] = gnosisSafeL2Address;

  // Deploy GnosisSafeProxyFactory
  const gnosisSafeProxyFactorySalt = ethers.keccak256(ethers.toUtf8Bytes("GnosisSafeProxyFactory"));
  const gnosisSafeProxyFactoryCalldata = buildDeployCalldata(gnosisSafeProxyFactoryBytecodeHash, gnosisSafeProxyFactorySalt);
  const gnosisSafeProxyFactoryTx = await deployer.sendTransaction({
    to: proxyAddress,
    data: gnosisSafeProxyFactoryCalldata,
    value: 0
  });
  const gnosisSafeProxyFactoryReceipt = await gnosisSafeProxyFactoryTx.wait();
  if (!gnosisSafeProxyFactoryReceipt) throw new Error("GnosisSafeProxyFactory deployment failed");
  const gnosisSafeProxyFactoryAddress = ethers.getCreate2Address(
    proxyAddress,
    gnosisSafeProxyFactorySalt,
    gnosisSafeProxyFactoryBytecodeHash
  );
  console.log("GnosisSafeProxyFactory deterministic deployment transaction:", gnosisSafeProxyFactoryReceipt.hash);
  console.log("GnosisSafeProxyFactory deterministic address:", gnosisSafeProxyFactoryAddress);
  deploymentAddresses["GnosisSafeProxyFactory"] = gnosisSafeProxyFactoryAddress;

  // Save deployment addresses to file
  const networkName = hre.network.name;
  const deploymentFile = path.join(deploymentDir, `${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentAddresses, null, 2));
  console.log(`\nDeployment addresses saved to: ${deploymentFile}`);

  console.log("\nAll contracts deployed successfully!");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });