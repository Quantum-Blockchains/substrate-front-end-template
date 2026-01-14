#!/usr/bin/env bash

cd ../
mkdir .build_substrate-front-end-template && cd .build_substrate-front-end-template

echo "Step 1. Build API"
git clone https://github.com/Quantum-Blockchains/api.git
cd api
git checkout kostia/v10.9.1
yarn install
yarn build

rm -r ../../substrate-front-end-template/node_modules/@polkadot/api
rm -r ../../substrate-front-end-template/node_modules/@polkadot/api-augment
rm -r ../../substrate-front-end-template/node_modules/@polkadot/api-base
rm -r ../../substrate-front-end-template/node_modules/@polkadot/api-derive
rm -r ../../substrate-front-end-template/node_modules/@polkadot/rpc-augment
rm -r ../../substrate-front-end-template/node_modules/@polkadot/rpc-core
rm -r ../../substrate-front-end-template/node_modules/@polkadot/rpc-provider
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types-augment
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types-codec
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types-create
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types-known
rm -r ../../substrate-front-end-template/node_modules/@polkadot/types-support
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-bridge
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-asmjs
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-init
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-wasm
rm -r ../../substrate-front-end-template/node_modules/@polkadot/wasm-util

cp -r packages/api/build ../../substrate-front-end-template/node_modules/@polkadot/api
cp -r packages/api-augment/build ../../substrate-front-end-template/node_modules/@polkadot/api-augment
cp -r packages/api-base/build ../../substrate-front-end-template/node_modules/@polkadot/api-base
cp -r packages/api-derive/build ../../substrate-front-end-template/node_modules/@polkadot/api-derive
cp -r packages/rpc-augment/build ../../substrate-front-end-template/node_modules/@polkadot/rpc-augment
cp -r packages/rpc-core/build ../../substrate-front-end-template/node_modules/@polkadot/rpc-core
cp -r packages/rpc-provider/build ../../substrate-front-end-template/node_modules/@polkadot/rpc-provider
cp -r packages/types/build ../../substrate-front-end-template/node_modules/@polkadot/types
cp -r packages/types-augment/build ../../substrate-front-end-template/node_modules/@polkadot/types-augment
cp -r packages/types-codec/build ../../substrate-front-end-template/node_modules/@polkadot/types-codec
cp -r packages/types-create/build ../../substrate-front-end-template/node_modules/@polkadot/types-create
cp -r packages/types-known/build ../../substrate-front-end-template/node_modules/@polkadot/types-known
cp -r packages/types-support/build ../../substrate-front-end-template/node_modules/@polkadot/types-support
cp -r node_modules/@polkadot/wasm-bridge ../../substrate-front-end-template/node_modules/@polkadot/wasm-bridge
cp -r node_modules/@polkadot/wasm-crypto ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto
cp -r node_modules/@polkadot/wasm-crypto-asmjs ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-asmjs
cp -r node_modules/@polkadot/wasm-crypto-init ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-init
cp -r node_modules/@polkadot/wasm-crypto-wasm ../../substrate-front-end-template/node_modules/@polkadot/wasm-crypto-wasm
cp -r node_modules/@polkadot/wasm-util ../../substrate-front-end-template/node_modules/@polkadot/wasm-util

cd ../
rm -r -f api

echo "Step 2. Build UI"
git clone https://github.com/Quantum-Blockchains/ui.git
cd ui
git checkout kostia/v3.5.1
yarn install
yarn build

# rm -r ../../substrate-front-end-template/node_modules/@polkadot/react-identicon
# rm -r ../../substrate-front-end-template/node_modules/@polkadot/react-qr
rm -r ../../substrate-front-end-template/node_modules/@polkadot/ui-keyring
rm -r ../../substrate-front-end-template/node_modules/@polkadot/ui-settings
# rm -r ../../substrate-front-end-template/node_modules/@polkadot/ui-shared

# cp -r packages/react-identicon/build ../../substrate-front-end-template/node_modules/@polkadot/react-identicon
# cp -r packages/react-qr/build ../../substrate-front-end-template/node_modules/@polkadot/react-qr
cp -r packages/ui-keyring/build ../../substrate-front-end-template/node_modules/@polkadot/ui-keyring
cp -r packages/ui-settings/build ../../substrate-front-end-template/node_modules/@polkadot/ui-settings
# cp -r packages/ui-shared/build ../../substrate-front-end-template/node_modules/@polkadot/ui-shared

cd ../
rm -r -f ui

echo "Step 3. Build COMMON"
git clone https://github.com/Quantum-Blockchains/common.git
cd common
git checkout kostia/v12.3.2
yarn install
yarn build

# rm -r ../../substrate-front-end-template/node_modules/@polkadot/hw-ledger
# rm -r ../../substrate-front-end-template/node_modules/@polkadot/hw-ledger-transports
rm -r ../../substrate-front-end-template/node_modules/@polkadot/keyring
rm -r ../../substrate-front-end-template/node_modules/@polkadot/networks
rm -r ../../substrate-front-end-template/node_modules/@polkadot/util
rm -r ../../substrate-front-end-template/node_modules/@polkadot/util-crypto
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-bigint
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-fetch
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-global
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-randomvalues
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-textdecoder
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-textencoder
rm -r ../../substrate-front-end-template/node_modules/@polkadot/x-ws

# cp -r packages/hw-ledger/build ../../substrate-front-end-template/node_modules/@polkadot/hw-ledger
# cp -r packages/hw-ledger-transports/build ../../substrate-front-end-template/node_modules/@polkadot/hw-ledger-transports
cp -r packages/keyring/build ../../substrate-front-end-template/node_modules/@polkadot/keyring
cp -r packages/networks/build ../../substrate-front-end-template/node_modules/@polkadot/networks
cp -r packages/util/build ../../substrate-front-end-template/node_modules/@polkadot/util
cp -r packages/util-crypto/build ../../substrate-front-end-template/node_modules/@polkadot/util-crypto
cp -r packages/x-bigint/build ../../substrate-front-end-template/node_modules/@polkadot/x-bigint
cp -r packages/x-fetch/build ../../substrate-front-end-template/node_modules/@polkadot/x-fetch
cp -r packages/x-global/build ../../substrate-front-end-template/node_modules/@polkadot/x-global
cp -r packages/x-randomvalues/build ../../substrate-front-end-template/node_modules/@polkadot/x-randomvalues
cp -r packages/x-textdecoder/build ../../substrate-front-end-template/node_modules/@polkadot/x-textdecoder
cp -r packages/x-textencoder/build ../../substrate-front-end-template/node_modules/@polkadot/x-textencoder
cp -r packages/x-ws/build ../../substrate-front-end-template/node_modules/@polkadot/x-ws

cd ../../
rm -r -f .build_substrate-front-end-template
cd substrate-front-end-template
