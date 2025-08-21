# depending on the os/platform - download eth-rpc and revive-dev-node into .bin folder

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | tr '[:upper:]' '[:lower:]')

REVIVE_NODE=revive-dev-node-${OS}-${ARCH}
ETH_RPC=eth-rpc-${OS}-${ARCH}
BIN_DIR=bin

# NODES_VERSION=17037231207
NODES_VERSION=latest

curl -sL https://github.com/paritytech/hardhat-polkadot/releases/download/nodes-${NODES_VERSION}/checksums.txt -o /tmp/node-${NODES_VERSION}-checksums.txt
CURRENT_CHECKSUM=$(cat ${BIN_DIR}/checksums.txt 2>/dev/null | tr -s ' ' ) || echo ""
NEW_CHECKSUM=$(cat /tmp/node-${NODES_VERSION}-checksums.txt | tr -s ' ')

mkdir -p ${BIN_DIR}

if [ "$CURRENT_CHECKSUM" != "$NEW_CHECKSUM" ]; then
  curl -sL https://github.com/paritytech/hardhat-polkadot/releases/download/nodes-${NODES_VERSION}/${REVIVE_NODE} -o ${BIN_DIR}/revive-dev-node
  curl -sL https://github.com/paritytech/hardhat-polkadot/releases/download/nodes-${NODES_VERSION}/${ETH_RPC} -o ${BIN_DIR}/eth-rpc
  cp /tmp/node-${NODES_VERSION}-checksums.txt ${BIN_DIR}/checksums.txt
else
  echo "Checksums match, skipping download"
fi

rm /tmp/node-${NODES_VERSION}-checksums.txt

chmod -R 755 ${BIN_DIR}