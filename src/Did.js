import React, { useState } from 'react'
import { Form, Input, Grid, Dropdown } from 'semantic-ui-react'
import { TxButton } from './substrate-lib/components'
import { ed25519PairFromSeed } from '@polkadot/util-crypto'
import { base58Encode } from '@polkadot/util-crypto'

export default function Main(props) {

    const [status, setStatus] = useState(null)
    const [seedinfo, setSeedinfo] = useState(null)
    const [didinfo, setDidinfo] = useState(null)
    const [verkeyinfo, setVerkeyinfo] = useState(null)
    const [verkey, setVerkey] = useState(null)
    const [did, setDid] = useState(null)
    const [error, setError] = useState(null)
    const [formState, setFormState] = useState({ seed: '', alias: '', role: 1 })

    const { seed, alias, role } = formState

    const roles = []
    roles.push({
        key: "Endorser",
        text: "Endorser",
        value: "EndorserRole",
      })

    const onChange = (_, data) =>
        setFormState(prev => {
            const { state, value } = data
            if (state === "seed") {
                if (value.length !== 32) {
                    setError("Error: (32 characters or base64)")
                    setSeedinfo("")
                    setDidinfo("")
                    setVerkeyinfo("")
                }
                else {
                    let utf8Encode = new TextEncoder()
                    let seedbytes = utf8Encode.encode(value);
                    let pair = ed25519PairFromSeed(seedbytes)
                    let did = base58Encode(pair.publicKey.slice(0,16))
                    let vk = base58Encode(pair.publicKey)
                    console.log("Verkey: ", vk )
                    console.log("DID: ", did)
                    setSeedinfo("Seed: "+value)
                    setDidinfo("Did: "+ did)
                    setVerkeyinfo("Verkey: "+ vk)
                    setVerkey(vk)
                    setDid(did)
                    setError("")
                }
            }
            
            // if prev.seed.length !== 32 {
            //     error = "Error"
            // }
            let res
            res = { ...prev, [data.state]: data.value }
            return res
        })

    return (
        <Grid.Column>
            <h1>Did</h1>
            <Form>
                <div style={{ overflowWrap: 'break-word' }}>{error}</div>
                <Form.Field>
                    <Input
                        fluid
                        label="seed"
                        type="text"
                        placeholder=""
                        value={seed}
                        state="seed"
                        onChange={onChange}
                    />
                </Form.Field>
                <Form.Field>
                    <Input
                        fluid
                        label="alias"
                        type="text"
                        placeholder=""
                        value={alias}
                        state="alias"
                        onChange={onChange}
                    />
                </Form.Field>
                <Form.Field>
                    <Dropdown
                        placeholder="Select role"
                        fluid
                        selection
                        search
                        options={roles}
                        value={role}
                        state="role"
                        onChange={onChange}
                    />
                </Form.Field>
            </Form>
            <Form.Field style={{ textAlign: 'center' }}>
                 <TxButton
                    label="Register did"
                    type="SIGNED-TX"
                    setStatus={setStatus}
                    attrs={{
                        palletRpc: 'did',
                        callable: 'registerNym',
                        inputParams: [alias, did, verkey, role],
                        paramFields: [true, true, true, true],
                    }}
                />
            </Form.Field>
            <div style={{ overflowWrap: 'break-word' }}>{seedinfo}</div>
            <div style={{ overflowWrap: 'break-word' }}>{didinfo}</div>
            <div style={{ overflowWrap: 'break-word' }}>{verkeyinfo}</div>
            <div style={{ overflowWrap: 'break-word' }}>{status}</div>
        </Grid.Column>
    )
}
