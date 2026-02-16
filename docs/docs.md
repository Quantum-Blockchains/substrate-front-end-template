# QSB DID Pallet Guide

A practical guide for creating and managing DIDs with the QSB DID pallet.
All actions are signed Substrate extrinsics, while DID-level authorization
uses ML-DSA-44 keys.

## Table of contents

- [Libraries used in examples](#libraries-used-in-examples)
- [DID format and signatures](#did-format-and-signatures)
- [Create DID (JS/TS)](#create-did-jsts)
- [Create DID (Python)](#create-did-python)
- [Pallet call reference](#pallet-call-reference)
- [Types and roles](#types-and-roles)
- [Encoding tips](#encoding-tips)

## Libraries used in examples

JS/TS
- Polkadot JS API: https://polkadot.js.org/docs/api/
- Polkadot JS Keyring: https://github.com/polkadot-js/common/tree/master/packages/keyring

Python
- substrate-interface: https://github.com/polkascan/py-substrate-interface

## DID format and signatures

- DID format: `did:qsb:<base58-32-byte-id>`
- `did_id` params accept either the full DID string (`did:qsb:...`) or the raw
  base58 ID without prefix.
- DID creation requires a signature over:
  `QSB_DID_CREATE || public_key`
  The pallet verifies this signature against the provided ML-DSA-44 public key.

## DID RPC (did_getByString)

The node exposes a custom RPC method:

- `did_getByString(did: String) -> Option<DidDetails>`

It resolves a DID to on-chain `DidDetails` using the runtime API.

### Example (JS/TS)

```ts
const did = 'did:qsb:...';
const result = await api.rpc.did.getByString(did);

if (result.isNone) {
  console.log('DID not found');
} else {
  console.log(result.toHuman());
}
```

### Example (JSON-RPC)

```json
{"jsonrpc":"2.0","id":1,"method":"did_getByString","params":["did:qsb:..."]}
```

## Create DID (JS/TS)

```ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { stringToU8a, u8aConcat } from '@polkadot/util';

const api = await ApiPromise.create({
  provider: new WsProvider('wss://qsb.qbck.io:9945')
});

const keyring = new Keyring({ type: 'sr25519' });
const signer = keyring.addFromUri('//Alice'); // fee payer

// ML-DSA-44 public key bytes
const publicKey = new Uint8Array(/* ... */);

// DID signature payload
const payload = u8aConcat(stringToU8a('QSB_DID_CREATE'), publicKey);
const didSignature = await mldsa44.sign(payload, secretKey); // Uint8Array

await api.tx.did
  .createDid(publicKey, didSignature)
  .signAndSend(signer);
```

## Create DID (Python)

```py
from substrateinterface import SubstrateInterface, Keypair

substrate = SubstrateInterface(url="wss://qsb.qbck.io:9945")

mldsa_pk = b"..."  # ML-DSA-44 public key
mldsa_sk = b"..."  # secret key (never send on-chain)

payload = b"QSB_DID_CREATE" + mldsa_pk
# Replace with your ML-DSA-44 signing implementation
# did_sig = mldsa44_sign(payload, mldsa_sk)

did_sig = b"..."  # bytes
signer = Keypair.create_from_uri("//Alice")

call = substrate.compose_call(
    call_module="Did",
    call_function="create_did",
    call_params={
        "public_key": mldsa_pk,
        "_did_signature": did_sig
    }
)

extrinsic = substrate.create_signed_extrinsic(call=call, keypair=signer)
receipt = substrate.submit_extrinsic(extrinsic, wait_for_inclusion=True)
print(receipt.is_success, receipt.triggered_events)
```

## Pallet call reference

All calls are in `pallet::call` and require a signed Substrate account.
The DID is passed as `did_id` (full DID or raw base58 ID).

| Call | Parameters | Description | Notes |
| --- | --- | --- | --- |
| `create_did` | `public_key`, `did_signature` | Create a new DID with an initial ML-DSA-44 key. | Signature is validated against `public_key`. |
| `add_key` | `did_id`, `public_key`, `roles` | Add a new key to a DID. | DID must be active. |
| `revoke_key` | `did_id`, `public_key` | Revoke an existing key. | Key must exist and not be revoked. |
| `rotate_key` | `did_id`, `old_public_key`, `new_public_key`, `roles` | Revoke old key and add a new key. | Atomic rotation. |
| `update_roles` | `did_id`, `public_key`, `roles` | Update roles for a key. | Key must be active. |
| `add_service` | `did_id`, `service` | Add a service endpoint. | `service` is a struct (see below). |
| `remove_service` | `did_id`, `service_id` | Remove a service by ID. | `service_id` is bytes. |
| `set_metadata` | `did_id`, `entry` | Set or update metadata key/value. | `entry` is a struct (see below). |
| `remove_metadata` | `did_id`, `key` | Remove metadata by key. | `key` is bytes. |
| `deactivate_did` | `did_id` | Deactivate DID permanently. | No further updates allowed. |

## Types and roles

### Key roles

- `Authentication`
- `AssertionMethod`
- `KeyAgreement`
- `CapabilityInvocation`
- `CapabilityDelegation`

### ServiceEndpoint

```rust
ServiceEndpoint {
  id: Vec<u8>,
  service_type: Vec<u8>,
  endpoint: Vec<u8>,
}
```

### MetadataEntry

```rust
MetadataEntry {
  key: Vec<u8>,
  value: Vec<u8>,
}
```

## Encoding tips

Many parameters are `Vec<u8>`. Convert strings to bytes before submitting
an extrinsic.

JS/TS
- `stringToU8a("text")`

Python
- `"text".encode("utf-8")`

Examples
- Service name: `stringToU8a("agent")`
- Service type: `stringToU8a("messaging")`
- Endpoint URL: `stringToU8a("https://example.com")`
- Metadata key/value: `stringToU8a("key")`, `stringToU8a("value")`

---

# QSB Schema Pallet Guide

Schema registry for verifiable credential schemas. Schemas are identified
by a hash derived from the schema JSON and chain genesis.

## Schema format and signatures

- Schema ID format: `did:qsb:schema:<base58-32-byte-id>`
- `schema_id` accepts either full schema ID string or raw base58 ID.
- Schema registration requires a DID signature over:
  `QSB_SCHEMA || genesis_hash || schema_json`
  The pallet verifies this signature against the issuer DID key.

## Register schema (JS/TS)

```ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { stringToU8a, u8aConcat } from '@polkadot/util';

const api = await ApiPromise.create({
  provider: new WsProvider('wss://qsb.qbck.io:9945')
});

const issuerDid = 'did:qsb:...';
const schemaUri = 'https://example.com/schema.json';
const schemaJson = JSON.stringify({ /* credential schema */ });

const payload = u8aConcat(
  stringToU8a('QSB_SCHEMA'),
  api.genesisHash.toU8a(),
  stringToU8a(schemaJson)
);

const didSignature = await mldsa44.sign(payload, didSecretKey);

await api.tx.schema
  .registerSchema(
    stringToU8a(schemaJson),
    stringToU8a(schemaUri),
    stringToU8a(issuerDid),
    didSignature
  )
  .signAndSend(submittingAccount);
```

## Register schema (Python)

```py
from substrateinterface import SubstrateInterface, Keypair

substrate = SubstrateInterface(url="wss://qsb.qbck.io:9945")

issuer_did = "did:qsb:..."
schema_uri = "https://example.com/schema.json"
schema_json = "{\"type\":\"object\",\"properties\":{}}"

payload = b"QSB_SCHEMA" + bytes(substrate.get_block_hash(0)) + schema_json.encode("utf-8")
did_sig = mldsa44_sign(payload, did_sk)

signer = Keypair.create_from_uri("//Alice")

call = substrate.compose_call(
    call_module="Schema",
    call_function="register_schema",
    call_params={
        "schema_json": schema_json.encode("utf-8"),
        "schema_uri": schema_uri.encode("utf-8"),
        "issuer_did": issuer_did.encode("utf-8"),
        "_did_signature": did_sig
    }
)

extrinsic = substrate.create_signed_extrinsic(call=call, keypair=signer)
receipt = substrate.submit_extrinsic(extrinsic, wait_for_inclusion=True)
print(receipt.is_success, receipt.triggered_events)
```

## Pallet call reference

| Call | Parameters | Description | Notes |
| --- | --- | --- | --- |
| `register_schema` | `schema_json`, `schema_uri`, `issuer_did`, `_did_signature` | Register a new schema. | Schema ID is derived from JSON. |
| `deprecate_schema` | `schema_id`, `issuer_did`, `_did_signature` | Deprecate an existing schema. | Only issuer can deprecate. |

## SchemaRecord

```rust
SchemaRecord {
  version: u64,
  deprecated: bool,
  issuer_did: Vec<u8>,
  schema_hash: [u8; 32],
  schema_uri: Vec<u8>,
}
```

## Encoding tips

Use `Vec<u8>` for `schema_json`, `schema_uri`, and `issuer_did`:

- JS/TS: `stringToU8a(value)`
- Python: `value.encode("utf-8")`
