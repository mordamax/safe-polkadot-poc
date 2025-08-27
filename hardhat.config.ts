import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@parity/hardhat-polkadot";
import * as dotenv from "dotenv";

// task compile-yul
import "./tasks/compile-yul";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.30",
  resolc: {
    compilerSource: "binary",
    settings: {
      resolcPath: './bin/resolc',
    }
  },
  networks: {
    hardhat: {
      polkavm: true,
      nodeConfig: {
        nodeBinaryPath: './bin/eth-rpc',
        rpcPort: 8000,
        dev: true,
      },
      adapterConfig: {
        adapterBinaryPath: './bin/eth-rpc',
        dev: true,
      },
    },
    local: {
      polkavm: true,
      url: 'http://127.0.0.1:8545',
      accounts: [
        process.env.LOCAL_PRIV_KEY as string,
        process.env.LOCAL_PRIV_KEY_2 as string,
      ],
    },

    ah_westend: {
      polkavm: true,
      url: "https://westend-asset-hub-eth-rpc.polkadot.io",
      accounts: [
        process.env.LOCAL_PRIV_KEY as string,
      ],
    },

    pah_paseo: {
      polkavm: true,
      url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
      accounts: [
        process.env.LOCAL_PRIV_KEY as string,
      ],
    }
  }
};

export default config;
