import React, { useCallback, useEffect, useState } from 'react'
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
  blake2AsU8a,
} from '@polkadot/util-crypto'
import { web3Enable, web3FromSource } from '@polkadot/extension-dapp'
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

  const normalizedMetadata = Array.isArray(chainData.metadata)
    ? chainData.metadata.map(entry => ({
        key: bytesToString(entry.key),
        value: bytesToString(entry.value),
      }))
    : []

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
    metadata: normalizedMetadata,
  }
}

const FEATURE_TABS = ['DID details', 'DID update', 'Schema']
const DID_ADD_KEY_PREFIX = 'QSB_DID_ADD_KEY'
const DID_REVOKE_KEY_PREFIX = 'QSB_DID_REVOKE_KEY'
const DID_DEACTIVATE_PREFIX = 'QSB_DID_DEACTIVATE'
const DID_ADD_SERVICE_PREFIX = 'QSB_DID_ADD_SERVICE'
const DID_REMOVE_SERVICE_PREFIX = 'QSB_DID_REMOVE_SERVICE'
const DID_SET_METADATA_PREFIX = 'QSB_DID_SET_METADATA'
const DID_REMOVE_METADATA_PREFIX = 'QSB_DID_REMOVE_METADATA'
const DID_UPDATE_ROLES_PREFIX = 'QSB_DID_UPDATE_ROLES'
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
  const [addKeyPublicKey, setAddKeyPublicKey] = useState('')
  const [addKeyRoles, setAddKeyRoles] = useState([])
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
  const [schemaDidInput, setSchemaDidInput] = useState('')
  const [schemaUrlInput, setSchemaUrlInput] = useState('')
  const [schemaJsonInput, setSchemaJsonInput] = useState('')
  const [schemaJsonError, setSchemaJsonError] = useState('')
  const [schemaIdValue, setSchemaIdValue] = useState('')
  const [isCreatingSchema, setIsCreatingSchema] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((type, content) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts(prev => [...prev, { id, type, content }])
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 4500)
  }, [])

  useEffect(() => {
    if (didDetailsError) {
      addToast('error', didDetailsError)
      setDidDetailsError('')
    }
  }, [addToast, didDetailsError])

  useEffect(() => {
    if (!didDetailsStatus || didDetailsStatus === 'Resolving DID...') {
      return
    }
    addToast('info', didDetailsStatus)
    setDidDetailsStatus('')
  }, [addToast, didDetailsStatus])

  useEffect(() => {
    if (didUpdateError) {
      addToast('error', didUpdateError)
      setDidUpdateError('')
    }
  }, [addToast, didUpdateError])

  useEffect(() => {
    if (!didUpdateStatus) {
      return
    }
    addToast('info', didUpdateStatus)
    setDidUpdateStatus('')
  }, [addToast, didUpdateStatus])

  useEffect(() => {
    if (didOptionsError) {
      addToast('error', didOptionsError)
      setDidOptionsError('')
    }
  }, [addToast, didOptionsError])

  useEffect(() => {
    if (didUpdateLoadError) {
      addToast('error', didUpdateLoadError)
      setDidUpdateLoadError('')
    }
  }, [addToast, didUpdateLoadError])

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
      if (!rpcResult) {
        setDidDetailsDocument(null)
        setDidDetailsStatus('')
        setDidDetailsError('DID not found.')
        return
      }
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
        <Card.Meta>Resolve DID via did_getByString RPC method.</Card.Meta>
      </Card.Content>
      <Card.Content>
        <Form>
          <Form.Group widths="equal">
            <Form.Field error={Boolean(didDetailsError)} width={14}>
              <label>Enter DID</label>
              <Dropdown
                fluid
                selection
                search
                allowAdditions
                placeholder="DID"
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
            <Form.Field width={2} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Button
                primary
                type="button"
                onClick={resolveDidDetails}
                loading={isResolvingDid}
                disabled={isResolvingDid}
                style={{ width: '140px' }}
              >
                Resolve
              </Button>
            </Form.Field>
          </Form.Group>
        </Form>
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
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
              dangerouslySetInnerHTML={{
                __html: jsonSyntaxHighlight(didDetailsDocument),
              }}
            >
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

  const jsonSyntaxHighlight = value => {
    const json = JSON.stringify(value, null, 2)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    return json.replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?)/g,
      match => {
        let color = '#6b7280'
        if (match.startsWith('"') && match.endsWith(':')) {
          color = '#e06c75'
        } else if (match.startsWith('"')) {
          color = '#98c379'
        } else if (match === 'true' || match === 'false') {
          color = '#56b6c2'
        } else if (match === 'null') {
          color = '#c678dd'
        } else {
          color = '#d19a66'
        }
        return `<span style="color:${color}">${match}</span>`
      }
    )
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

  const loadDidUpdateDetails = useCallback(async () => {
    if (activeFeature !== 'DID update') {
      return
    }

    if (!didUpdateInput.trim()) {
      setDidUpdateChainData(null)
      setDidUpdateLoadError('')
      return
    }

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
  }, [activeFeature, api, didUpdateInput])

  useEffect(() => {
    if (activeFeature !== 'DID update') {
      return
    }

    const timeout = setTimeout(() => {
      loadDidUpdateDetails()
    }, 300)

    return () => clearTimeout(timeout)
  }, [activeFeature, didUpdateInput, loadDidUpdateDetails])

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

  const requestDidPassword = async (did, payload) => {
    const extensions = await web3Enable(config.APP_NAME)
    const extension = extensions.find(item => item?.dids?.sign)

    if (!extension?.dids?.sign) {
      throw new Error('Extension does not support DID signing.')
    }

    await extension.dids.sign({ did, payload })
  }

  const normalizeDidSignature = rawSignature => {
    if (!rawSignature) {
      return null
    }

    if (typeof rawSignature === 'string') {
      if (isHex(rawSignature)) {
        return rawSignature
      }
      const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      if (base64Pattern.test(rawSignature)) {
        try {
          const decoded = atob(rawSignature)
          const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0))
          return u8aToHex(bytes)
        } catch (error) {
          return stringToHex(rawSignature)
        }
      }
      return stringToHex(rawSignature)
    }

    if (rawSignature instanceof Uint8Array) {
      return u8aToHex(rawSignature)
    }

    if (Array.isArray(rawSignature)) {
      return u8aToHex(Uint8Array.from(rawSignature))
    }

    if (typeof rawSignature === 'object') {
      if (typeof rawSignature.toHex === 'function') {
        return rawSignature.toHex()
      }

      const candidate =
        rawSignature.signature ??
        rawSignature.signatureHex ??
        rawSignature.didSignature ??
        rawSignature.signed ??
        rawSignature.result?.signature ??
        null

      return normalizeDidSignature(candidate)
    }

    return null
  }

  const requestDidSignature = async (did, payloadBytes) => {
    const extensions = await web3Enable(config.APP_NAME)
    const extension = extensions.find(item => item?.dids?.sign)

    if (!extension?.dids?.sign) {
      throw new Error('Extension does not support DID signing.')
    }

    const payloadHex = u8aToHex(payloadBytes)
    const signRequest = {
      did,
      payload: payloadHex,
    }
    const rawSignature = await extension.dids.sign(signRequest)
    const didSignature = normalizeDidSignature(rawSignature)

    if (!didSignature) {
      throw new Error('Extension returned an invalid DID signature.')
    }

    return didSignature
  }

  const buildSetMetadataDidPayload = (didValue, entry) => {
    // Build payload from call argument codecs to mirror pallet verification exactly:
    // prefix || did_id.encode() || entry.encode()
    const call = api.tx.did.setMetadata(didValue, entry, '0x')
    const didIdEncoded = call.method.args[0].toU8a()
    const entryEncoded = call.method.args[1].toU8a()
    const prefix = stringToU8a(DID_SET_METADATA_PREFIX)
    const payload = u8aConcat(prefix, didIdEncoded, entryEncoded)

    return payload
  }

  const buildDidPayload = (prefixValue, call) => {
    // Payload expected by pallet: prefix || all call args except did_signature
    const prefix = stringToU8a(prefixValue)
    const encodedArgs = call.method.args
      .slice(0, Math.max(0, call.method.args.length - 1))
      .map(arg => arg.toU8a())

    return u8aConcat(prefix, ...encodedArgs)
  }

  const wrapSignerWithDid = (signer, did) => {
    if (!did || !signer?.signPayload) {
      return signer
    }

    return {
      ...signer,
      signPayload: async payload => {
        await requestDidPassword(did, payload)
        return signer.signPayload(payload)
      },
    }
  }

  const submitTx = async (tx, statusLabel, didForSignature) => {
    const fromAccount = await getFromAccount()
    if (!fromAccount) {
      setDidUpdateError('Unable to sign the transaction.')
      return
    }

    setDidUpdateError('')
    setDidUpdateStatus(statusLabel)
    setIsUpdatingDid(true)

    try {
      const [addressOrPair, options] = fromAccount
      const hasInjectedSigner = Boolean(options?.signer)
      const signer = hasInjectedSigner
        ? wrapSignerWithDid(options.signer, didForSignature)
        : undefined

      const signPromise = hasInjectedSigner
        ? tx.signAndSend(addressOrPair, { ...options, signer }, result => {
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
            loadDidUpdateDetails()
          } else {
            setDidUpdateStatus(
              `Current transaction status: ${result.status.type}`
            )
          }
        })
        : tx.signAndSend(...fromAccount, result => {
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
            loadDidUpdateDetails()
          } else {
            setDidUpdateStatus(
              `Current transaction status: ${result.status.type}`
            )
          }
        })

      await signPromise
    } catch (error) {
      setDidUpdateStatus('')
      setDidUpdateError(`Failed to submit: ${error.message}`)
      setIsUpdatingDid(false)
    }
  }

  const submitSchemaTx = async (tx, statusLabel, didForSignature) => {
    const fromAccount = await getFromAccount()
    if (!fromAccount) {
      addToast('error', 'Unable to sign the transaction.')
      return
    }

    setIsCreatingSchema(true)
    addToast('info', statusLabel)

    try {
      const [addressOrPair, options] = fromAccount
      const hasInjectedSigner = Boolean(options?.signer)
      const signer = hasInjectedSigner
        ? wrapSignerWithDid(options.signer, didForSignature)
        : undefined

      const signPromise = hasInjectedSigner
        ? tx.signAndSend(addressOrPair, { ...options, signer }, result => {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              const decoded = api.registry.findMetaError(
                result.dispatchError.asModule
              )
              addToast('error', `Transaction failed: ${decoded.section}.${decoded.name}`)
            } else {
              addToast('error', `Transaction failed: ${result.dispatchError.toString()}`)
            }
            setIsCreatingSchema(false)
            return
          }

          if (result.status.isFinalized) {
            addToast(
              'info',
              `Transaction finalized. Block: ${result.status.asFinalized.toString()}`
            )
            setIsCreatingSchema(false)
          }
        })
        : tx.signAndSend(...fromAccount, result => {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              const decoded = api.registry.findMetaError(
                result.dispatchError.asModule
              )
              addToast('error', `Transaction failed: ${decoded.section}.${decoded.name}`)
            } else {
              addToast('error', `Transaction failed: ${result.dispatchError.toString()}`)
            }
            setIsCreatingSchema(false)
            return
          }

          if (result.status.isFinalized) {
            addToast(
              'info',
              `Transaction finalized. Block: ${result.status.asFinalized.toString()}`
            )
            setIsCreatingSchema(false)
          }
        })

      await signPromise
    } catch (error) {
      addToast('error', `Failed to submit: ${error.message}`)
      setIsCreatingSchema(false)
    }
  }

  const buildSchemaId = schemaJson => {
    if (!api?.genesisHash) {
      return ''
    }
    const schemaBytes = stringToU8a(schemaJson)
    const material = u8aConcat(
      stringToU8a('QSB_SCHEMA'),
      api.genesisHash.toU8a(),
      schemaBytes
    )
    const schemaId = blake2AsU8a(material, 256)
    return `did:qsb:schema:${base58Encode(schemaId)}`
  }

  const submitCreateSchema = async () => {
    if (!ensureApiReady()) {
      return
    }

    const didValue = normalizeDidInput(schemaDidInput)
    if (didValue.error) {
      addToast('error', didValue.error)
      return
    }

    if (!schemaUrlInput.trim()) {
      addToast('error', 'Enter a schema URL.')
      return
    }

    if (!schemaJsonInput.trim()) {
      addToast('error', 'Enter a JSON schema.')
      return
    }

    try {
      JSON.parse(schemaJsonInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON.'
      setSchemaJsonError(message)
      addToast('error', `Invalid JSON: ${message}`)
      return
    }

    const schemaId = buildSchemaId(schemaJsonInput.trim())
    setSchemaIdValue(schemaId)

    if (!api?.tx?.schema?.registerSchema) {
      addToast('error', 'Schema pallet is not available in this runtime.')
      return
    }

    const schemaJsonHex = stringToHex(schemaJsonInput.trim())
    const schemaUrlHex = stringToHex(schemaUrlInput.trim())
    const issuerDidHex = stringToHex(didValue.did)

    await submitSchemaTx(
      api.tx.schema.registerSchema(
        schemaJsonHex,
        schemaUrlHex,
        issuerDidHex,
        new Uint8Array()
      ),
      'Registering schema...',
      didValue.did
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

    const payload = buildDidPayload(
      DID_ADD_KEY_PREFIX,
      api.tx.did.addKey(didValue, publicKey, addKeyRoles, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.addKey(didValue, publicKey, addKeyRoles, didSignature),
      'Adding key...',
      null
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

    const payload = buildDidPayload(
      DID_REVOKE_KEY_PREFIX,
      api.tx.did.revokeKey(didValue, publicKey, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.revokeKey(didValue, publicKey, didSignature),
      'Revoking key...',
      null
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

    const payload = buildDidPayload(
      DID_DEACTIVATE_PREFIX,
      api.tx.did.deactivateDid(didValue, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.deactivateDid(didValue, didSignature),
      'Deactivating DID...',
      null
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

    const payload = buildDidPayload(
      DID_ADD_SERVICE_PREFIX,
      api.tx.did.addService(didValue, service, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.addService(didValue, service, didSignature),
      'Adding service...',
      null
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

    const payload = buildDidPayload(
      DID_REMOVE_SERVICE_PREFIX,
      api.tx.did.removeService(didValue, serviceId, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.removeService(didValue, serviceId, didSignature),
      'Removing service...',
      null
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

    const payload = buildSetMetadataDidPayload(didValue, entry)
    const didSignature = await requestDidSignature(didValue, payload)
    await submitTx(
      api.tx.did.setMetadata(didValue, entry, didSignature),
      'Setting metadata...',
      null
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

    const payload = buildDidPayload(
      DID_REMOVE_METADATA_PREFIX,
      api.tx.did.removeMetadata(didValue, key, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.removeMetadata(didValue, key, didSignature),
      'Removing metadata...',
      null
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

    const payload = buildDidPayload(
      DID_UPDATE_ROLES_PREFIX,
      api.tx.did.updateRoles(didValue, publicKey, updateRolesValues, '0x')
    )
    const didSignature = await requestDidSignature(didValue, payload)

    await submitTx(
      api.tx.did.updateRoles(
        didValue,
        publicKey,
        updateRolesValues,
        didSignature
      ),
      'Updating roles...',
      null
    )
  }

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
              placeholder="DID"
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
            <Header as="h4">Existing Services</Header>
            {services.length === 0 ? (
              <Message size="small" info content="No services found for this DID." />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '1em',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  alignItems: 'stretch',
                  gridAutoRows: '1fr',
                }}
              >
                {services.map((service, index) => {
                  const serviceIdHex = formatBytesHex(service.id)
                  const serviceIdText = formatBytesText(service.id)
                  const serviceTypeText = formatBytesText(service.service_type)
                  const endpointText = formatBytesText(service.endpoint)
                  const normalizedDid = normalizeDidInput(didUpdateInput)
                  const ownerDid = normalizedDid?.did || didUpdateInput.trim()
                  const serviceName = serviceIdText || serviceIdHex || '—'

                  return (
                    <Segment
                      key={`${serviceIdHex}-${index}`}
                      style={{
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        minHeight: '180px',
                        margin: 0,
                      }}
                    >
                      <div style={{ marginBottom: '.5em' }}>
                        <Header as="h5" style={{ marginBottom: 0 }}>
                          Service {index + 1}
                        </Header>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ wordBreak: 'break-word' }}>
                          <strong>Name:</strong> {ownerDid}#{serviceName}
                        </div>
                        <div style={{ wordBreak: 'break-word' }}>
                          <strong>Type:</strong> {serviceTypeText || '—'}
                        </div>
                        <div style={{ wordBreak: 'break-word' }}>
                          <strong>Endpoint:</strong> {endpointText || '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: 'auto' }}>
                        <Button
                          negative
                          type="button"
                          onClick={() => submitRemoveServiceValue(serviceIdHex)}
                          loading={isUpdatingDid}
                          disabled={isUpdatingDid}
                        >
                          Remove
                        </Button>
                      </div>
                    </Segment>
                  )
                })}
              </div>
            )}
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Add New Service
            </Header>
            <Form>
              <Form.Group widths="equal">
                <Form.Field>
                  <Input
                    fluid
                    placeholder="Name"
                    value={serviceIdInput}
                    onChange={(_, changed) => {
                      setServiceIdInput(changed.value)
                      clearDidUpdateMessages()
                    }}
                  />
                </Form.Field>
                <Form.Field>
                  <Input
                    fluid
                    placeholder="Type"
                    value={serviceTypeInput}
                    onChange={(_, changed) => {
                      setServiceTypeInput(changed.value)
                      clearDidUpdateMessages()
                    }}
                  />
                </Form.Field>
                <Form.Field>
                  <Input
                    fluid
                    placeholder="Endpoint"
                    value={serviceEndpointInput}
                    onChange={(_, changed) => {
                      setServiceEndpointInput(changed.value)
                      clearDidUpdateMessages()
                    }}
                  />
                </Form.Field>
              </Form.Group>
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
            <Header as="h4">Existing Metadata</Header>
            {metadata.length === 0 ? (
              <Message size="small" info content="No metadata found for this DID." />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '1em',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  alignItems: 'stretch',
                  gridAutoRows: '1fr',
                }}
              >
                {metadata.map((entry, index) => {
                  const keyHex = formatBytesHex(entry.key)
                  const keyText = formatBytesText(entry.key)
                  const valueText = formatBytesText(entry.value)

                  return (
                    <Segment
                      key={`${keyHex}-${index}`}
                      style={{
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        minHeight: '180px',
                        margin: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '.5em',
                        }}
                      >
                        <Header as="h5" style={{ marginBottom: 0 }}>
                          Entry {index + 1}
                        </Header>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ wordBreak: 'break-word' }}>
                          <strong>Key:</strong> {keyText || keyHex || '—'}
                        </div>
                        <div style={{ wordBreak: 'break-word' }}>
                          <strong>Value:</strong> {valueText || '—'}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '.5em',
                          marginTop: 'auto',
                        }}
                      >
                        <Button
                          type="button"
                          onClick={() => {
                            setMetadataKeyInput(keyText || keyHex)
                            setMetadataValueInput(valueText)
                            clearDidUpdateMessages()
                          }}
                          disabled={isUpdatingDid}
                        >
                          Update
                        </Button>
                        <Button
                          negative
                          type="button"
                          onClick={() => submitRemoveMetadataValue(keyHex)}
                          loading={isUpdatingDid}
                          disabled={isUpdatingDid}
                        >
                          Remove
                        </Button>
                      </div>
                    </Segment>
                  )
                })}
              </div>
            )}
            <Header as="h4" style={{ marginTop: '1.5em' }}>
              Add New Metadata
            </Header>
            <Form>
              <Form.Group widths="equal">
                <Form.Field>
                  <Input
                    fluid
                    placeholder="Key"
                    value={metadataKeyInput}
                    onChange={(_, changed) => {
                      setMetadataKeyInput(changed.value)
                      clearDidUpdateMessages()
                    }}
                  />
                </Form.Field>
                <Form.Field>
                  <Input
                    fluid
                    placeholder="Value"
                    value={metadataValueInput}
                    onChange={(_, changed) => {
                      setMetadataValueInput(changed.value)
                      clearDidUpdateMessages()
                    }}
                  />
                </Form.Field>
              </Form.Group>
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
      </Card.Content>
      </Card>
    )
  }

  const renderSchemaCard = () => (
    <Card fluid style={{ marginTop: '1.5em' }}>
      <Card.Content>
        <Card.Header>Schema</Card.Header>
        <Card.Meta>Create a credential schema for a DID.</Card.Meta>
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
              placeholder="DID"
              options={didOptions}
              loading={isLoadingDids}
              value={schemaDidInput}
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
                setSchemaDidInput(changed.value)
                setSchemaJsonError('')
                setSchemaIdValue('')
              }}
            />
          </Form.Field>
          <Form.Field>
            <label>Schema URL</label>
            <Input
              placeholder="https://example.com/schema.json"
              value={schemaUrlInput}
              onChange={(_, changed) => {
                setSchemaUrlInput(changed.value)
                setSchemaIdValue('')
              }}
            />
          </Form.Field>
          <Form.Field error={Boolean(schemaJsonError)}>
            <label>Credential schema (JSON)</label>
            <Form.TextArea
              placeholder='{"$schema":"https://json-schema.org/draft/2020-12/schema"}'
              rows={8}
              value={schemaJsonInput}
              onChange={(_, changed) => {
                setSchemaJsonInput(changed.value)
                if (schemaJsonError) {
                  setSchemaJsonError('')
                }
                setSchemaIdValue('')
              }}
            />
            {schemaJsonError && (
              <div style={{ color: '#a94442', marginTop: '6px' }}>
                {schemaJsonError}
              </div>
            )}
          </Form.Field>
          <Form.Field>
            <label>Schema ID</label>
            <Input
              fluid
              readOnly
              placeholder="Schema ID will appear after validation"
              value={schemaIdValue}
            />
          </Form.Field>
          <Button
            primary
            type="button"
            onClick={submitCreateSchema}
            loading={isCreatingSchema}
            disabled={isCreatingSchema}
          >
            Create schema
          </Button>
        </Form>
      </Card.Content>
    </Card>
  )

  const renderFeatureContent = () => {
    if (activeFeature === 'DID details') {
      return renderDidDetailsCard()
    }

    if (activeFeature === 'DID update') {
      return renderDidUpdateCard()
    }

    return renderSchemaCard()
  }

  return (
    <Grid.Column width={16}>
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '520px',
          width: '420px',
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: toast.type === 'error' ? '#8f1d1d' : '#0b8a82',
              color: '#fff',
              borderRadius: '6px',
              padding: '10px 12px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              fontSize: '0.95em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <span style={{ flex: 1, textAlign: 'center', whiteSpace: 'normal' }}>
              {toast.content}
            </span>
            <button
              type="button"
              onClick={() => setToasts(prev => prev.filter(item => item.id !== toast.id))}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1em',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
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
