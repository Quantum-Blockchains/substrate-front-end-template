import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  // Divider,
  Dropdown,
  Form,
  Grid,
  Header,
  Icon,
  Input,
  Menu,
  Message,
  Segment,
} from 'semantic-ui-react'
import {
  base58Decode,
  base58Encode,
  cryptoWaitReady,
  mnemonicGenerate,
} from '@polkadot/util-crypto'
import { web3Enable, web3FromSource } from '@polkadot/extension-dapp'
import { Keyring } from '@polkadot/keyring'
import {
  hexToU8a,
  isHex,
  stringToHex,
  stringToU8a,
  u8aConcat,
  u8aToHex,
  u8aToString,
} from '@polkadot/util'

import { useSubstrateState } from './substrate-lib'
import config from './config'

const buildDidDocument = (didValue, chainData) => {
  if (!didValue || !chainData) return null

  const keys = Array.isArray(chainData.keys) ? chainData.keys : []
  const services = Array.isArray(chainData.services) ? chainData.services : []

  const verificationMethod = keys.map((key, index) => {
    const material = Uint8Array.from(key.public_key || [])
    const methodId = `${didValue}#keys-${index + 1}`

    return {
      id: methodId,
      type: 'ML-DSA-44',
      controller: didValue,
      publicKeyMultibase: `z${base58Encode(material)}`,
      revoked: key.revoked || false,
      roles: key.roles || [],
    }
  })

  const authentication = verificationMethod
    .filter(method => (method.roles || []).includes('Authentication'))
    .map(method => method.id)
  const assertionMethod = verificationMethod
    .filter(method => (method.roles || []).includes('AssertionMethod'))
    .map(method => method.id)
  const keyAgreement = verificationMethod
    .filter(method => (method.roles || []).includes('KeyAgreement'))
    .map(method => method.id)
  const capabilityInvocation = verificationMethod
    .filter(method => (method.roles || []).includes('CapabilityInvocation'))
    .map(method => method.id)
  const capabilityDelegation = verificationMethod
    .filter(method => (method.roles || []).includes('CapabilityDelegation'))
    .map(method => method.id)

  const bytesToString = value => {
    if (!value) return ''
    if (typeof value === 'string') return value
    try {
      const text = u8aToString(Uint8Array.from(value))
      return text || u8aToHex(Uint8Array.from(value))
    } catch (error) {
      return u8aToHex(Uint8Array.from(value))
    }
  }

  const normalizedServices = services.map(service => {
    const name = bytesToString(service.id)
    const type = bytesToString(service.service_type || service.serviceType)
    const endpoint = bytesToString(service.endpoint)

    return {
      id: name ? `${didValue}#${name}` : `${didValue}#service`,
      type,
      serviceEndpoint: endpoint,
    }
  })

  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: didValue,
    version: chainData.version ?? null,
    deactivated: chainData.deactivated ?? false,
    verificationMethod,
    authentication,
    assertionMethod,
    keyAgreement,
    capabilityInvocation,
    capabilityDelegation,
    service: normalizedServices,
    metadata: chainData.metadata || [],
  }
}

const FEATURE_TABS = ['DID details', 'Create DID', 'DID update', 'Schema']
const ROLE_OPTIONS = [
  { key: 'Authentication', text: 'Authentication', value: 'Authentication' },
  {
    key: 'AssertionMethod',
    text: 'AssertionMethod',
    value: 'AssertionMethod',
  },
  { key: 'KeyAgreement', text: 'KeyAgreement', value: 'KeyAgreement' },
  {
    key: 'CapabilityInvocation',
    text: 'CapabilityInvocation',
    value: 'CapabilityInvocation',
  },
  {
    key: 'CapabilityDelegation',
    text: 'CapabilityDelegation',
    value: 'CapabilityDelegation',
  },
]

export default function DidDataStorage() {
  const { api, currentAccount } = useSubstrateState()
  const [didDetailsInput, setDidDetailsInput] = useState('')
  const [didDetailsError, setDidDetailsError] = useState('')
  const [didDetailsStatus, setDidDetailsStatus] = useState('')
  const [didDetailsDocument, setDidDetailsDocument] = useState(null)
  const [isResolvingDid, setIsResolvingDid] = useState(false)
  const [didUpdateInput, setDidUpdateInput] = useState('')
  const [createDidSeed, setCreateDidSeed] = useState('')
  const [createDidPublicKey, setCreateDidPublicKey] = useState(null)
  const [createDidSignature, setCreateDidSignature] = useState(null)
  const [isGeneratingDid, setIsGeneratingDid] = useState(false)
  const [addKeyPublicKey, setAddKeyPublicKey] = useState('')
  const [addKeyRoles, setAddKeyRoles] = useState([])
  const [rotateOldPublicKey, setRotateOldPublicKey] = useState('')
  const [rotateNewPublicKey, setRotateNewPublicKey] = useState('')
  const [rotateKeyRoles, setRotateKeyRoles] = useState([])
  const [updateRolesPublicKey, setUpdateRolesPublicKey] = useState('')
  const [updateRolesValues, setUpdateRolesValues] = useState([])
  const [serviceIdInput, setServiceIdInput] = useState('')
  const [serviceTypeInput, setServiceTypeInput] = useState('')
  const [serviceEndpointInput, setServiceEndpointInput] = useState('')
  const [metadataKeyInput, setMetadataKeyInput] = useState('')
  const [metadataValueInput, setMetadataValueInput] = useState('')
  const [didUpdateError, setDidUpdateError] = useState('')
  const [didUpdateStatus, setDidUpdateStatus] = useState('')
  const [isUpdatingDid, setIsUpdatingDid] = useState(false)
  const [activeFeature, setActiveFeature] = useState(FEATURE_TABS[0])
  const [didOptions, setDidOptions] = useState([])
  const [didOptionsError, setDidOptionsError] = useState('')
  const [isLoadingDids, setIsLoadingDids] = useState(false)
  const [didUpdateSection, setDidUpdateSection] = useState('Keys')
  const [didUpdateChainData, setDidUpdateChainData] = useState(null)
  const [didUpdateLoadError, setDidUpdateLoadError] = useState('')
  const [isLoadingDidUpdate, setIsLoadingDidUpdate] = useState(false)

  const normalizeDidInput = rawValue => {
    const value = rawValue.trim()
    if (!value) {
      return { error: 'Enter a DID.' }
    }

    const embeddedMatch = value.match(/did:q(?:sb|bs):[A-Za-z0-9]+/)
    if (embeddedMatch) {
      const embedded = embeddedMatch[0]
      const normalizedDid = embedded.startsWith('did:qbs:')
        ? embedded.replace('did:qbs:', 'did:qsb:')
        : embedded
      const didIdPart = normalizedDid.slice('did:qsb:'.length)
      try {
        const decoded = base58Decode(didIdPart)
        if (decoded.length !== 32) {
          return { error: 'DID must decode to 32 bytes.' }
        }
        return {
          did: normalizedDid,
          didId: didIdPart,
          didIdLength: decoded.length,
          didIdHex: u8aToHex(decoded),
        }
      } catch (error) {
        return { error: 'Invalid DID format. Use did:qsb:<id>.' }
      }
    }

    if (isHex(value)) {
      const bytes = hexToU8a(value)
      if (bytes.length !== 32) {
        return { error: 'Hex DID must be 32 bytes.' }
      }
      const didIdPart = base58Encode(bytes)
      const did = `did:qsb:${didIdPart}`
      return {
        did,
        didId: didIdPart,
        didIdLength: bytes.length,
        didIdHex: u8aToHex(bytes),
      }
    }

    if (value.startsWith('did:qsb:') || value.startsWith('did:qbs:')) {
      const normalizedDid = value.startsWith('did:qbs:')
        ? value.replace('did:qbs:', 'did:qsb:')
        : value
      const didIdPart = normalizedDid.slice('did:qsb:'.length)
      try {
        const decoded = base58Decode(didIdPart)
        if (decoded.length !== 32) {
          return { error: 'DID must decode to 32 bytes.' }
        }
        return {
          did: normalizedDid,
          didId: didIdPart,
          didIdLength: decoded.length,
          didIdHex: u8aToHex(decoded),
        }
      } catch (error) {
        return { error: 'Invalid DID format. Use did:qsb:<id>.' }
      }
    }

    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
      try {
        const decoded = base58Decode(value)
        if (decoded.length !== 32) {
          return { error: 'DID must decode to 32 bytes.' }
        }
        return {
          did: `did:qsb:${value}`,
          didId: value,
          didIdLength: decoded.length,
          didIdHex: u8aToHex(decoded),
        }
      } catch (error) {
        return { error: 'Invalid DID format. Use did:qsb:<id>.' }
      }
    }

    return { error: 'Invalid DID format. Use did:qsb:<id> or 0x<32-byte>.' }
  }

  const formatBytesHex = value => {
    if (!value) return ''
    if (typeof value === 'string') return value
    return u8aToHex(Uint8Array.from(value))
  }

  const formatBytesText = value => {
    if (!value) return ''
    if (typeof value === 'string') return value
    try {
      return u8aToString(Uint8Array.from(value))
    } catch (error) {
      return ''
    }
  }

  const normalizeRoles = roles =>
    (Array.isArray(roles) ? roles : [])
      .map(role => {
        if (typeof role === 'string') {
          return role
        }
        if (typeof role === 'number') {
          return ROLE_OPTIONS[role]?.value
        }
        if (role && typeof role === 'object') {
          const [key] = Object.keys(role)
          return key || null
        }
        return null
      })
      .filter(Boolean)

  const resolveDidDetails = async () => {
    const provider = api?._rpcCore?.provider
    if (!provider) {
      setDidDetailsError('RPC provider is not ready yet.')
      return
    }

    const normalized = normalizeDidInput(didDetailsInput)
    if (normalized.error) {
      setDidDetailsError(normalized.error)
      setDidDetailsDocument(null)
      return
    }

    setDidDetailsError('')
    setDidDetailsStatus('Resolving DID...')
    setIsResolvingDid(true)
    setDidDetailsDocument(null)

    try {
      const response = await provider.send('did_getByString', [normalized.did])
      const rpcResult = response?.result ?? response
      setDidDetailsDocument(buildDidDocument(normalized.did, rpcResult))
      setDidDetailsStatus('DID resolved successfully.')
    } catch (error) {
      setDidDetailsStatus('')
      setDidDetailsError(`Failed to resolve DID: ${error.message}`)
    } finally {
      setIsResolvingDid(false)
    }
  }

  const renderDidDetailsCard = () => (
    <Card fluid style={{ marginTop: '1.5em' }}>
      <Card.Content>
        <Card.Header>DID details</Card.Header>
        <Card.Meta>Resolve DID metadata via did_getByString RPC method.</Card.Meta>
      </Card.Content>
      <Card.Content>
        <Form>
          <Form.Field error={Boolean(didDetailsError)}>
            <label>Enter DID</label>
            <Dropdown
              fluid
              selection
              search
              allowAdditions
              placeholder="Type or select a DID"
              options={didOptions}
              loading={isLoadingDids}
              value={didDetailsInput}
              onAddItem={(_, { value }) => {
                const newValue = String(value || '').trim()
                if (!newValue) {
                  return
                }
                setDidOptions(prev => {
                  if (prev.some(option => option.value === newValue)) {
                    return prev
                  }
                  return [
                    ...prev,
                    { key: newValue, value: newValue, text: newValue },
                  ]
                })
              }}
              onChange={(_, changed) => {
                setDidDetailsInput(changed.value)
                if (didDetailsError) {
                  setDidDetailsError('')
                }
                if (didDetailsStatus) {
                  setDidDetailsStatus('')
                }
              }}
            />
          </Form.Field>
          <Button
            primary
            type="button"
            onClick={resolveDidDetails}
            loading={isResolvingDid}
            disabled={isResolvingDid}
          >
            Resolve
          </Button>
        </Form>
        {didOptionsError && (
          <Message
            info
            size="small"
            style={{ marginTop: '.5em' }}
            content={didOptionsError}
          />
        )}
        {didDetailsError && (
          <Message
            negative
            size="small"
            style={{ marginTop: '.5em' }}
            content={didDetailsError}
          />
        )}
        {didDetailsStatus && (
          <Message
            info
            size="small"
            style={{ marginTop: didDetailsError ? '.5em' : '.75em' }}
            content={didDetailsStatus}
          />
        )}
        {didDetailsDocument && (
          <Segment
            style={{
              marginTop: '.75em',
              background: '#f9fafb',
              overflowX: 'auto',
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(didDetailsDocument, null, 2)}
            </pre>
          </Segment>
        )}
      </Card.Content>
    </Card>
  )

  const clearDidUpdateMessages = () => {
    if (didUpdateError) {
      setDidUpdateError('')
    }
    if (didUpdateStatus) {
      setDidUpdateStatus('')
    }
  }

  const toU8aInput = value => {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    if (isHex(trimmed)) {
      return trimmed
    }
    return stringToHex(trimmed)
  }

  const getFromAccount = async () => {
    if (!currentAccount) {
      return null
    }

    const {
      address,
      meta: { source, isInjected },
    } = currentAccount

    if (!isInjected) {
      return [currentAccount]
    }

    const injector = await web3FromSource(source)
    return [address, { signer: injector.signer }]
  }

  const generateDidKeypair = async () => {
    clearDidUpdateMessages()
    setIsGeneratingDid(true)

    try {
      await cryptoWaitReady()
      const seed = mnemonicGenerate()
      const keyring = new Keyring({ type: 'mldsa44' })
      const pair = keyring.addFromUri(seed, {}, 'mldsa44')
      const payload = u8aConcat(stringToU8a('QSB_DID_CREATE'), pair.publicKey)
      const signature = pair.sign(payload)

      setCreateDidSeed(seed)
      setCreateDidPublicKey(pair.publicKey)
      setCreateDidSignature(signature)
    } catch (error) {
      setDidUpdateError(`Failed to generate keypair: ${error.message}`)
    } finally {
      setIsGeneratingDid(false)
    }
  }

  const loadDidsFromExtension = async () => {
    setIsLoadingDids(true)
    setDidOptionsError('')

    try {
      const extensions = await web3Enable(config.APP_NAME)
      const didRecords = []
      let hasDidsSupport = false

      for (const extension of extensions) {
        if (extension?.dids?.list) {
          hasDidsSupport = true
          const list = await extension.dids.list()
          didRecords.push(...(list || []))
        }
      }

      if (!hasDidsSupport) {
        setDidOptions([])
        setDidOptionsError('Extension does not expose DID storage.')
        return
      }

      const uniqueRecords = new Map()
      didRecords.forEach(record => {
        if (record?.did && !uniqueRecords.has(record.did)) {
          uniqueRecords.set(record.did, record)
        }
      })

      const options = Array.from(uniqueRecords.values()).map(record => ({
        key: record.did,
        value: record.did,
        text: record.name ? `${record.name} (${record.did})` : record.did,
      }))

      setDidOptions(options)
      if (options.length === 0) {
        setDidOptionsError('No DIDs found in extension storage.')
      }
    } catch (error) {
      setDidOptions([])
      setDidOptionsError(`Failed to load DIDs: ${error.message}`)
    } finally {
      setIsLoadingDids(false)
    }
  }

  useEffect(() => {
    if (activeFeature === 'DID update' || activeFeature === 'DID details') {
      loadDidsFromExtension()
    }
  }, [activeFeature])

  useEffect(() => {
    if (activeFeature !== 'DID update') {
      return
    }

    if (!didUpdateInput.trim()) {
      setDidUpdateChainData(null)
      setDidUpdateLoadError('')
      return
    }

    const timeout = setTimeout(() => {
      ;(async () => {
        const provider = api?._rpcCore?.provider
        if (!provider) {
          setDidUpdateLoadError('RPC provider is not ready yet.')
          setDidUpdateChainData(null)
          return
        }

        const normalized = normalizeDidInput(didUpdateInput)
        if (normalized.error) {
          setDidUpdateLoadError(normalized.error)
          setDidUpdateChainData(null)
          return
        }

        setIsLoadingDidUpdate(true)
        setDidUpdateLoadError('')

        try {
          const response = await provider.send('did_getByString', [normalized.did])
          const rpcResult = response?.result ?? response
          setDidUpdateChainData(rpcResult)
        } catch (error) {
          setDidUpdateChainData(null)
          setDidUpdateLoadError(`Failed to load DID data: ${error.message}`)
        } finally {
          setIsLoadingDidUpdate(false)
        }
      })()
    }, 300)

    return () => clearTimeout(timeout)
  }, [activeFeature, didUpdateInput, api])

  const ensureApiReady = () => {
    if (!api) {
      setDidUpdateError('API is not ready yet.')
      return false
    }
    if (!currentAccount) {
      setDidUpdateError('Select an account before submitting.')
      return false
    }
    return true
  }

  const ensureDidValue = () => {
    const normalized = normalizeDidInput(didUpdateInput)
    if (normalized.error) {
      setDidUpdateError(normalized.error)
      return null
    }
    return normalized.did
  }

  const submitTx = async (tx, statusLabel) => {
    const fromAccount = await getFromAccount()
    if (!fromAccount) {
      setDidUpdateError('Unable to sign the transaction.')
      return
    }

    setDidUpdateError('')
    setDidUpdateStatus(statusLabel)
    setIsUpdatingDid(true)

    try {
      await tx.signAndSend(...fromAccount, result => {
        if (result.dispatchError) {
          if (result.dispatchError.isModule) {
            const decoded = api.registry.findMetaError(
              result.dispatchError.asModule
            )
            setDidUpdateError(
              `Transaction failed: ${decoded.section}.${decoded.name}`
            )
          } else {
            setDidUpdateError(
              `Transaction failed: ${result.dispatchError.toString()}`
            )
          }
          setDidUpdateStatus('')
          setIsUpdatingDid(false)
          return
        }

        if (result.status.isFinalized) {
          setDidUpdateStatus(
            `Transaction finalized. Block: ${result.status.asFinalized.toString()}`
          )
          setIsUpdatingDid(false)
        } else {
          setDidUpdateStatus(
            `Current transaction status: ${result.status.type}`
          )
        }
      })
    } catch (error) {
      setDidUpdateStatus('')
      setDidUpdateError(`Failed to submit: ${error.message}`)
      setIsUpdatingDid(false)
    }
  }

  const submitCreateDid = async () => {
    if (!ensureApiReady()) {
      return
    }

    if (!createDidPublicKey || !createDidSignature) {
      setDidUpdateError('Generate a keypair first.')
      return
    }

    await submitTx(
      api.tx.did.createDid(createDidPublicKey, createDidSignature),
      'Creating DID...'
    )
  }

  const submitAddKey = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const publicKey = toU8aInput(addKeyPublicKey)
    if (!publicKey) {
      setDidUpdateError('Enter a public key to add.')
      return
    }

    if (!addKeyRoles.length) {
      setDidUpdateError('Select at least one role.')
      return
    }

    await submitTx(
      api.tx.did.addKey(didValue, publicKey, addKeyRoles),
      'Adding key...'
    )
  }

  const submitRevokeKeyValue = async publicKeyValue => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const publicKey = toU8aInput(publicKeyValue)
    if (!publicKey) {
      setDidUpdateError('Enter a public key to revoke.')
      return
    }

    await submitTx(
      api.tx.did.revokeKey(didValue, publicKey),
      'Revoking key...'
    )
  }

  const submitDeactivateDid = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    await submitTx(
      api.tx.did.deactivateDid(didValue),
      'Deactivating DID...'
    )
  }

  const submitAddService = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const serviceId = toU8aInput(serviceIdInput)
    if (!serviceId) {
      setDidUpdateError('Enter a service id.')
      return
    }

    const serviceType = toU8aInput(serviceTypeInput)
    if (!serviceType) {
      setDidUpdateError('Enter a service type.')
      return
    }

    const endpoint = toU8aInput(serviceEndpointInput)
    if (!endpoint) {
      setDidUpdateError('Enter a service endpoint.')
      return
    }

    const service = {
      id: serviceId,
      serviceType,
      endpoint,
    }

    await submitTx(
      api.tx.did.addService(didValue, service),
      'Adding service...'
    )
  }

  const submitRemoveServiceValue = async serviceIdValue => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const serviceId = toU8aInput(serviceIdValue)
    if (!serviceId) {
      setDidUpdateError('Enter a service id to remove.')
      return
    }

    await submitTx(
      api.tx.did.removeService(didValue, serviceId),
      'Removing service...'
    )
  }

  const submitSetMetadata = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const key = toU8aInput(metadataKeyInput)
    if (!key) {
      setDidUpdateError('Enter a metadata key.')
      return
    }

    const value = toU8aInput(metadataValueInput)
    if (!value) {
      setDidUpdateError('Enter a metadata value.')
      return
    }

    const entry = {
      key,
      value,
    }

    await submitTx(
      api.tx.did.setMetadata(didValue, entry),
      'Setting metadata...'
    )
  }

  const submitRemoveMetadataValue = async keyValue => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const key = toU8aInput(keyValue)
    if (!key) {
      setDidUpdateError('Enter a metadata key to remove.')
      return
    }

    await submitTx(
      api.tx.did.removeMetadata(didValue, key),
      'Removing metadata...'
    )
  }

  const submitRotateKey = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const oldPublicKey = toU8aInput(rotateOldPublicKey)
    if (!oldPublicKey) {
      setDidUpdateError('Enter the old public key.')
      return
    }

    const newPublicKey = toU8aInput(rotateNewPublicKey)
    if (!newPublicKey) {
      setDidUpdateError('Enter the new public key.')
      return
    }

    if (!rotateKeyRoles.length) {
      setDidUpdateError('Select at least one role.')
      return
    }

    await submitTx(
      api.tx.did.rotateKey(
        didValue,
        oldPublicKey,
        newPublicKey,
        rotateKeyRoles
      ),
      'Rotating key...'
    )
  }

  const submitUpdateRoles = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = ensureDidValue()
    if (!didValue) {
      return
    }

    const publicKey = toU8aInput(updateRolesPublicKey)
    if (!publicKey) {
      setDidUpdateError('Enter a public key.')
      return
    }

    if (!updateRolesValues.length) {
      setDidUpdateError('Select at least one role.')
      return
    }

    await submitTx(
      api.tx.did.updateRoles(
        didValue,
        publicKey,
        updateRolesValues
      ),
      'Updating roles...'
    )
  }

  const renderCreateDidCard = () => (
    <Card fluid style={{ marginTop: '1.5em' }}>
      <Card.Content>
        <Card.Header>Create DID</Card.Header>
        <Card.Meta>Create a new DID from a public key.</Card.Meta>
      </Card.Content>
      <Card.Content>
        <Form>
          <Form.Field>
            <label>Generate ML-DSA-44 keypair</label>
            <Button
              primary
              type="button"
              onClick={generateDidKeypair}
              loading={isGeneratingDid}
              disabled={isGeneratingDid}
            >
              Generate keypair
            </Button>
          </Form.Field>
          <Form.Field>
            <label>Seed phrase (save it)</label>
            <Input
              fluid
              readOnly
              value={createDidSeed}
              placeholder="Generate a keypair to see the seed phrase"
            />
          </Form.Field>
          <Form.Field>
            <label>Public key (hex)</label>
            <Input
              fluid
              readOnly
              value={createDidPublicKey ? u8aToHex(createDidPublicKey) : ''}
              placeholder="Generate a keypair to see the public key"
            />
          </Form.Field>
          <Button
            primary
            type="button"
            onClick={submitCreateDid}
            loading={isUpdatingDid}
            disabled={isUpdatingDid || !createDidPublicKey}
          >
            Create DID
          </Button>
        </Form>
        {didUpdateError && (
          <Message
            negative
            size="small"
            style={{ marginTop: '.5em' }}
            content={didUpdateError}
          />
        )}
        {didUpdateStatus && (
          <Message
            info
            size="small"
            style={{ marginTop: didUpdateError ? '.5em' : '.75em' }}
            content={didUpdateStatus}
          />
        )}
      </Card.Content>
    </Card>
  )

  const renderDidUpdateCard = () => {
    const keys = Array.isArray(didUpdateChainData?.keys)
      ? didUpdateChainData.keys
      : []
    const services = Array.isArray(didUpdateChainData?.services)
      ? didUpdateChainData.services
      : []
    const metadata = Array.isArray(didUpdateChainData?.metadata)
      ? didUpdateChainData.metadata
      : []

    return (
      <Card fluid style={{ marginTop: '1.5em' }}>
      <Card.Content>
        <Card.Header>DID update</Card.Header>
        <Card.Meta>Manage DID keys, services, and metadata on-chain.</Card.Meta>
      </Card.Content>
      <Card.Content>
        <Form>
          <Form.Field>
            <label>Target DID</label>
            <Dropdown
              fluid
              selection
              search
              allowAdditions
              placeholder="Type or select a DID"
              options={didOptions}
              loading={isLoadingDids}
              value={didUpdateInput}
              onAddItem={(_, { value }) => {
                const newValue = String(value || '').trim()
                if (!newValue) {
                  return
                }
                setDidOptions(prev => {
                  if (prev.some(option => option.value === newValue)) {
                    return prev
                  }
                  return [
                    ...prev,
                    { key: newValue, value: newValue, text: newValue },
                  ]
                })
              }}
              onChange={(_, changed) => {
                setDidUpdateInput(changed.value)
                clearDidUpdateMessages()
              }}
            />
          </Form.Field>
          {didUpdateInput.trim() && (
            <Message
              size="small"
              info
              style={{ marginTop: '.5em' }}
              content={() => {
                const normalized = normalizeDidInput(didUpdateInput)
                if (normalized.error) {
                  return `Normalized DID error: ${normalized.error}`
                }
                return `Normalized DID: ${normalized.did} | id: ${normalized.didId} (len ${normalized.didIdLength}) | id hex: ${normalized.didIdHex}`
              }}
            />
          )}
          {didOptionsError && (
            <Message
              info
              size="small"
              style={{ marginTop: '.5em' }}
              content={didOptionsError}
            />
          )}
        </Form>
        <Form>
          <Form.Field>
            <label>What to update</label>
            <Dropdown
              fluid
              selection
              options={[
                { key: 'keys', text: 'Keys', value: 'Keys' },
                { key: 'services', text: 'Services', value: 'Services' },
                { key: 'metadata', text: 'Metadata', value: 'Metadata' },
                { key: 'rotate-key', text: 'Rotate key', value: 'Rotate key' },
                { key: 'deactivate', text: 'Deactivate DID', value: 'Deactivate DID' },
              ]}
              value={didUpdateSection}
              onChange={(_, changed) => setDidUpdateSection(changed.value)}
            />
          </Form.Field>
        </Form>
        {isLoadingDidUpdate && (
          <Message
            info
            size="small"
            style={{ marginTop: '.5em' }}
            content="Loading DID data..."
          />
        )}
        {didUpdateLoadError && (
          <Message
            negative
            size="small"
            style={{ marginTop: '.5em' }}
            content={didUpdateLoadError}
          />
        )}
        {didUpdateSection === 'Keys' && (
          <Segment>
            <Header as="h4">Existing keys</Header>
            {keys.length === 0 ? (
              <Message size="small" info content="No keys found for this DID." />
            ) : (
              keys.map((key, index) => {
                const publicKeyHex = formatBytesHex(key.public_key)
                const roles = normalizeRoles(key.roles)
                const isRevoked = Boolean(key.revoked)

                return (
                  <Segment key={`${publicKeyHex}-${index}`}>
                    <Header as="h5">Key {index + 1}</Header>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Public key:</strong> {publicKeyHex || '—'}
                    </div>
                    <div>
                      <strong>Roles:</strong>{' '}
                      {roles.length ? roles.join(', ') : '—'}
                    </div>
                    <div>
                      <strong>Status:</strong> {isRevoked ? 'revoked' : 'active'}
                    </div>
                    <Button
                      negative
                      type="button"
                      onClick={() => submitRevokeKeyValue(publicKeyHex)}
                      loading={isUpdatingDid}
                      disabled={isUpdatingDid || isRevoked}
                      style={{ marginTop: '.5em' }}
                    >
                      Revoke
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setUpdateRolesPublicKey(publicKeyHex)
                        setUpdateRolesValues(roles)
                        clearDidUpdateMessages()
                      }}
                      disabled={isUpdatingDid}
                      style={{ marginTop: '.5em' }}
                    >
                      Update roles
                    </Button>
                  </Segment>
                )
              })
            )}
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Update roles
            </Header>
            <Form>
              <Form.Field>
                <label>Public key</label>
                <Input
                  fluid
                  placeholder="0x... or text"
                  value={updateRolesPublicKey}
                  onChange={(_, changed) => {
                    setUpdateRolesPublicKey(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Roles</label>
                <Dropdown
                  fluid
                  multiple
                  selection
                  search
                  options={ROLE_OPTIONS}
                  placeholder="Select roles"
                  value={updateRolesValues}
                  onChange={(_, changed) => {
                    setUpdateRolesValues(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Button
                primary
                type="button"
                onClick={submitUpdateRoles}
                loading={isUpdatingDid}
                disabled={isUpdatingDid}
              >
                Update roles
              </Button>
            </Form>
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Add new key
            </Header>
            <Form>
              <Form.Field>
                <label>Public key</label>
                <Input
                  fluid
                  placeholder="0x... or text"
                  value={addKeyPublicKey}
                  onChange={(_, changed) => {
                    setAddKeyPublicKey(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Roles</label>
                <Dropdown
                  fluid
                  multiple
                  selection
                  search
                  options={ROLE_OPTIONS}
                  placeholder="Select roles"
                  value={addKeyRoles}
                  onChange={(_, changed) => {
                    setAddKeyRoles(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Button
                primary
                type="button"
                onClick={submitAddKey}
                loading={isUpdatingDid}
                disabled={isUpdatingDid}
              >
                Add key
              </Button>
            </Form>
          </Segment>
        )}
        {didUpdateSection === 'Services' && (
          <Segment>
            <Header as="h4">Existing service</Header>
            {services.length === 0 ? (
              <Message size="small" info content="No services found for this DID." />
            ) : (
              services.map((service, index) => {
                const serviceIdHex = formatBytesHex(service.id)
                const serviceIdText = formatBytesText(service.id)
                const serviceTypeText = formatBytesText(service.service_type)
                const endpointText = formatBytesText(service.endpoint)
                const normalizedDid = normalizeDidInput(didUpdateInput)
                const ownerDid = normalizedDid?.did || didUpdateInput.trim()
                const serviceName = serviceIdText || serviceIdHex || '—'

                return (
                  <Segment key={`${serviceIdHex}-${index}`}>
                    <Header as="h5">Service {index + 1}</Header>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Name:</strong> {ownerDid}#{serviceName}
                    </div>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Type:</strong> {serviceTypeText || '—'}
                    </div>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Endpoint:</strong> {endpointText || '—'}
                    </div>
                    <Button
                      negative
                      type="button"
                      onClick={() => submitRemoveServiceValue(serviceIdHex)}
                      loading={isUpdatingDid}
                      disabled={isUpdatingDid}
                      style={{ marginTop: '.5em' }}
                    >
                      Remove
                    </Button>
                  </Segment>
                )
              })
            )}
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Add new service
            </Header>
            <Form>
              <Form.Field>
                <label>Name</label>
                <Input
                  fluid
                  placeholder="service-name"
                  value={serviceIdInput}
                  onChange={(_, changed) => {
                    setServiceIdInput(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Service type</label>
                <Input
                  fluid
                  placeholder="type"
                  value={serviceTypeInput}
                  onChange={(_, changed) => {
                    setServiceTypeInput(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Endpoint</label>
                <Input
                  fluid
                  placeholder="https://..."
                  value={serviceEndpointInput}
                  onChange={(_, changed) => {
                    setServiceEndpointInput(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Button
                primary
                type="button"
                onClick={submitAddService}
                loading={isUpdatingDid}
                disabled={isUpdatingDid}
              >
                Add service
              </Button>
            </Form>
          </Segment>
        )}
        {didUpdateSection === 'Metadata' && (
          <Segment>
            <Header as="h4">Existing metadata</Header>
            {metadata.length === 0 ? (
              <Message size="small" info content="No metadata found for this DID." />
            ) : (
              metadata.map((entry, index) => {
                const keyHex = formatBytesHex(entry.key)
                const keyText = formatBytesText(entry.key)
                const valueText = formatBytesText(entry.value)

                return (
                  <Segment key={`${keyHex}-${index}`}>
                    <Header as="h5">Entry {index + 1}</Header>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Key:</strong> {keyText || keyHex || '—'}
                    </div>
                    <div style={{ wordBreak: 'break-word' }}>
                      <strong>Value:</strong> {valueText || '—'}
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setMetadataKeyInput(keyText || keyHex)
                        setMetadataValueInput(valueText)
                        clearDidUpdateMessages()
                      }}
                      disabled={isUpdatingDid}
                      style={{ marginTop: '.5em' }}
                    >
                      Update
                    </Button>
                    <Button
                      negative
                      type="button"
                      onClick={() => submitRemoveMetadataValue(keyHex)}
                      loading={isUpdatingDid}
                      disabled={isUpdatingDid}
                      style={{ marginTop: '.5em' }}
                    >
                      Remove
                    </Button>
                  </Segment>
                )
              })
            )}
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Add new metadata
            </Header>
            <Form>
              <Form.Field>
                <label>Metadata key</label>
                <Input
                  fluid
                  placeholder="key"
                  value={metadataKeyInput}
                  onChange={(_, changed) => {
                    setMetadataKeyInput(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Metadata value</label>
                <Input
                  fluid
                  placeholder="value"
                  value={metadataValueInput}
                  onChange={(_, changed) => {
                    setMetadataValueInput(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Button
                primary
                type="button"
                onClick={submitSetMetadata}
                loading={isUpdatingDid}
                disabled={isUpdatingDid}
              >
                Set metadata
              </Button>
            </Form>
          </Segment>
        )}
        {didUpdateSection === 'Rotate key' && (
          <Segment>
            <Header as="h4">Rotate key</Header>
            <Form>
              <Form.Field>
                <label>Old public key</label>
                <Input
                  fluid
                  placeholder="0x... or text"
                  value={rotateOldPublicKey}
                  onChange={(_, changed) => {
                    setRotateOldPublicKey(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>New public key</label>
                <Input
                  fluid
                  placeholder="0x... or text"
                  value={rotateNewPublicKey}
                  onChange={(_, changed) => {
                    setRotateNewPublicKey(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Form.Field>
                <label>Roles for new key</label>
                <Dropdown
                  fluid
                  multiple
                  selection
                  search
                  options={ROLE_OPTIONS}
                  placeholder="Select roles"
                  value={rotateKeyRoles}
                  onChange={(_, changed) => {
                    setRotateKeyRoles(changed.value)
                    clearDidUpdateMessages()
                  }}
                />
              </Form.Field>
              <Button
                primary
                type="button"
                onClick={submitRotateKey}
                loading={isUpdatingDid}
                disabled={isUpdatingDid}
              >
                Rotate key
              </Button>
            </Form>
          </Segment>
        )}
        {didUpdateSection === 'Deactivate DID' && (
          <Segment>
            <Header as="h4">Deactivate DID</Header>
            <Button
              negative
              type="button"
              onClick={submitDeactivateDid}
              loading={isUpdatingDid}
              disabled={isUpdatingDid}
            >
              Deactivate DID
            </Button>
          </Segment>
        )}
        {didUpdateError && (
          <Message
            negative
            size="small"
            style={{ marginTop: '.5em' }}
            content={didUpdateError}
          />
        )}
        {didUpdateStatus && (
          <Message
            info
            size="small"
            style={{ marginTop: didUpdateError ? '.5em' : '.75em' }}
            content={didUpdateStatus}
          />
        )}
      </Card.Content>
      </Card>
    )
  }

  const renderFeatureContent = () => {
    if (activeFeature === 'DID details') {
      return renderDidDetailsCard()
    }

    if (activeFeature === 'Create DID') {
      return renderCreateDidCard()
    }

    if (activeFeature === 'DID update') {
      return renderDidUpdateCard()
    }

    return (
      <Segment placeholder style={{ marginTop: '1.5em', textAlign: 'center' }}>
        <Header icon>
          <Icon name="sitemap" />
          Schema management will be available in this tab.
        </Header>
      </Segment>
    )
  }

  return (
    <Grid.Column width={16}>
      <Header as="h2" dividing style={{ marginBottom: '0.75em' }}>
        <Icon name="cogs" color="grey" />
        <Header.Content>DID Control Center</Header.Content>
      </Header>

      <Menu pointing secondary stackable style={{ marginBottom: '1.5em' }}>
        {FEATURE_TABS.map(tab => (
          <Menu.Item
            key={tab}
            name={tab}
            active={activeFeature === tab}
            onClick={() => setActiveFeature(tab)}
          />
        ))}
      </Menu>

      {renderFeatureContent()}
    </Grid.Column>
  )
}
