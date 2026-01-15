import React, { useState, useEffect } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import {
  Menu,
  Button,
  Dropdown,
  Container,
  Icon,
  Image,
  Label,
  Input,
  Message,
  Modal,
} from 'semantic-ui-react'

import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { BN } from '@polkadot/util'

import { useSubstrate, useSubstrateState } from './substrate-lib'

const acctAddr = acct => (acct ? acct.address : '')

function Main(props) {
  const {
    setCurrentAccount,
    state: { keyring, currentAccount },
  } = useSubstrate()
  const { api } = useSubstrateState()
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveAddress, setReceiveAddress] = useState('')
  const [receiveStatus, setReceiveStatus] = useState('')
  const [isSendingFunds, setIsSendingFunds] = useState(false)

  // Get the list of accounts we possess the private key for
  const keyringOptions = keyring.getPairs().map(account => ({
    key: account.address,
    value: account.address,
    text: account.meta.name.toUpperCase(),
    icon: 'user',
  }))

  const initialAddress =
    keyringOptions.length > 0 ? keyringOptions[0].value : ''

  // Set the initial address
  useEffect(() => {
    // `setCurrentAccount()` is called only when currentAccount is null (uninitialized)
    !currentAccount &&
      initialAddress.length > 0 &&
      setCurrentAccount(keyring.getPair(initialAddress))
  }, [currentAccount, setCurrentAccount, keyring, initialAddress])

  const onChange = addr => {
    setCurrentAccount(keyring.getPair(addr))
  }

  const sendFunds = async () => {
    setReceiveStatus('')

    if (!api) {
      setReceiveStatus('API is not ready yet.')
      return
    }

    if (!receiveAddress.trim()) {
      setReceiveStatus('Enter an account address.')
      return
    }

    setIsSendingFunds(true)

    try {
      await cryptoWaitReady()
      const tempKeyring = new Keyring({ type: 'sr25519' })
      const senderPair = tempKeyring.addFromUri('//Alice')

      const decimals = api.registry.chainDecimals?.[0] ?? 0
      const base = new BN(10).pow(new BN(decimals))
      let amount = base.div(new BN(100000))
      if (amount.isZero()) {
        amount = new BN(1)
      }

      await api.tx.balances
        .transferKeepAlive(receiveAddress.trim(), amount)
        .signAndSend(senderPair, result => {
          if (result.dispatchError) {
            if (result.dispatchError.isModule) {
              const decoded = api.registry.findMetaError(
                result.dispatchError.asModule
              )
              setReceiveStatus(
                `Transaction failed: ${decoded.section}.${decoded.name}`
              )
            } else {
              setReceiveStatus(
                `Transaction failed: ${result.dispatchError.toString()}`
              )
            }
            setIsSendingFunds(false)
            return
          }

          if (result.status.isFinalized) {
            setReceiveStatus('Transfer finalized.')
            setIsSendingFunds(false)
          }
        })
    } catch (error) {
      setReceiveStatus(`Failed to send: ${error.message}`)
      setIsSendingFunds(false)
    }
  }

  return (
    <Menu
      attached="top"
      tabular
      style={{
        backgroundColor: '#fff',
        borderColor: '#fff',
        paddingTop: '1em',
        paddingBottom: '1em',
      }}
    >
      <Container>
        <Menu.Menu>
          <Image
            src={`${process.env.PUBLIC_URL}/assets/substrate-logo.png`}
            size="mini"
          />
        </Menu.Menu>
        <Menu.Menu position="right" style={{ alignItems: 'center' }}>
          <CopyToClipboard text={acctAddr(currentAccount)}>
            <Button
              basic
              circular
              size="large"
              icon="user"
              color={currentAccount ? 'green' : 'red'}
            />
          </CopyToClipboard>
          <Dropdown
            search
            selection
            clearable
            placeholder="Select an account"
            options={keyringOptions}
            onChange={(_, dropdown) => {
              onChange(dropdown.value)
            }}
            value={acctAddr(currentAccount)}
          />
          <BalanceAnnotation />
          <Button
            basic
            size="small"
            style={{ marginLeft: '0.75em' }}
            onClick={() => {
              setReceiveOpen(true)
              setReceiveStatus('')
            }}
          >
            Receive funds
          </Button>
        </Menu.Menu>
      </Container>
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        size="small"
      >
        <Modal.Header>Receive funds</Modal.Header>
        <Modal.Content>
          <div style={{ marginBottom: '0.75em' }}>Account address</div>
          <Input
            fluid
            placeholder="Enter account address"
            value={receiveAddress}
            onChange={(_, data) => {
              setReceiveAddress(data.value)
              setReceiveStatus('')
            }}
          />
          {receiveStatus && (
            <Message
              info
              size="small"
              style={{ marginTop: '0.75em' }}
              content={receiveStatus}
            />
          )}
        </Modal.Content>
        <Modal.Actions>
          <Button
            primary
            loading={isSendingFunds}
            disabled={isSendingFunds}
            onClick={sendFunds}
          >
            Receive
          </Button>
        </Modal.Actions>
      </Modal>
    </Menu>
  )
}

function BalanceAnnotation(props) {
  const { api, currentAccount } = useSubstrateState()
  const [accountBalance, setAccountBalance] = useState(0)

  // When account address changes, update subscriptions
  useEffect(() => {
    let unsubscribe

    // If the user has selected an address, create a new subscription
    currentAccount &&
      api.query.system
        .account(acctAddr(currentAccount), balance =>
          setAccountBalance(balance.data.free.toHuman())
        )
        .then(unsub => (unsubscribe = unsub))
        .catch(console.error)

    return () => unsubscribe && unsubscribe()
  }, [api, currentAccount])

  return currentAccount ? (
    <Label pointing="left">
      <Icon name="money" color="green" />
      {accountBalance}
    </Label>
  ) : null
}

export default function AccountSelector(props) {
  const { api, keyring } = useSubstrateState()
  return keyring.getPairs && api.query ? <Main {...props} /> : null
}
