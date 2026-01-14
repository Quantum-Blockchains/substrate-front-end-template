import React, { useEffect, useState } from 'react'
import { Table, Grid, Label } from 'semantic-ui-react'
import { useSubstrateState } from './substrate-lib'
// import * as THREE from 'three';


// const ThreeDCube = () => {
//     const ref = useRef(null);
//
//     useEffect(() => {
//         let mouseX = 0;
//         let mouseY = 0;
//
//         const scene = new THREE.Scene();
//         const camera = new THREE.PerspectiveCamera(
//             75, window.innerWidth / window.innerHeight, 0.1, 1000);
//         const renderer = new THREE.WebGLRenderer();
//         renderer.setSize(window.innerWidth*0.5, window.innerHeight*0.5);
//         ref.current.appendChild(renderer.domElement);
//
//         const materials = [
//             // Front face (red)
//             new THREE.MeshBasicMaterial({ color: 0xff0000 }),
//             // Back face (green)
//             new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
//             // Top face (blue)
//             new THREE.MeshBasicMaterial({ color: 0x0000ff }),
//             // Bottom face (yellow)
//             new THREE.MeshBasicMaterial({ color: 0xffff00 }),
//             // Right face (magenta)
//             new THREE.MeshBasicMaterial({ color: 0xff00ff }),
//             // Left face (cyan)
//             new THREE.MeshBasicMaterial({ color: 0x00ffff })
//         ];
//
//         const cube = new THREE.Mesh(new THREE.BoxGeometry(), materials);
//         scene.add(cube);
//
//         camera.position.z = 5;
//
//         const animate = () => {
//             requestAnimationFrame(animate);
//
//             cube.rotation.x += (mouseY - cube.rotation.x) * 0.05;
//             cube.rotation.y += (mouseX - cube.rotation.y) * 0.05;
//
//             renderer.render(scene, camera);
//         };
//
//         const onMouseMove = (event) => {
//             mouseX = (event.clientX / window.innerWidth) * 2 - 1;
//             mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
//         };
//
//         animate();
//
//         window.addEventListener('mousemove', onMouseMove);
//
//         return () => {
//             window.removeEventListener('mousemove', onMouseMove);
//             ref.current.removeChild(renderer.domElement);
//         };
//     }, []);
//
//     return <dir ref={ref}></dir>;
// };


export default function Main(props) {
    const { api } = useSubstrateState()
    // const accounts = keyring.getPairs()
    // const [balances, setBalances] = useState({})
    const [peers, setPeers] = useState({})

    useEffect(() => {
        // const addresses = keyring.getPairs().map(account => account.address)
        let unsubscribeAll = null
        api.query.hypercube.peers(peers => {
                let decoder = new TextDecoder("utf-8")
            setPeers(peers.map(peer => decoder.decode(peer)))
            // setPeers(peers)
            })
            .then(unsub => {
                unsubscribeAll = unsub
            })
            .catch(console.error)

        // api.query.system.account
        //     .multi(addresses, balances => {
        //         const balancesMap = addresses.reduce(
        //             (acc, address, index) => ({
        //                 ...acc,
        //                 [address]: balances[index].data.free.toHuman(),
        //             }),
        //             {}
        //         )
        //         setBalances(balancesMap)
        //     })
        //     .then(unsub => {
        //         unsubscribeAll = unsub
        //     })
        //     .catch(console.error)

        return () => unsubscribeAll && unsubscribeAll()
    }, [api, setPeers ])
    console.log(peers.length)
    console.log(peers)
    return (
        <Grid.Column>
            <h1>Hypercube</h1>
            {peers.length === undefined ? (
                <Label basic color="yellow">
                    No peers to be shown
                </Label>
            ) : (
                <Table celled striped size="small">
                    <Table.Body>
                        <Table.Row>
                            <Table.Cell width={2} textAlign="left">
                                <strong>Index</strong>
                            </Table.Cell>
                            <Table.Cell width={10} textAlign="left">
                                <strong>PeerId</strong>
                            </Table.Cell>
                        </Table.Row>
                        {peers.map((peer, index) => (
                            <Table.Row>
                                <Table.Cell width={2} textAlign="left">
                                    <strong>{index}</strong>
                                </Table.Cell>
                                <Table.Cell width={10} textAlign="left">
                                    <strong>{peer}</strong>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            )}
            {/*<ThreeDCube />*/}
        </Grid.Column>
    )
}
