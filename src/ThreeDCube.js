// App.js
import React, {
    useEffect,
    useRef
} from 'react';
import * as THREE from 'three';

const ThreeDCube = () => {
    const ref = useRef(null);

    useEffect(() => {
        let mouseX = 0;
        let mouseY = 0;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        ref.current.appendChild(renderer.domElement);

        const materials = [
            // Front face (red)
            new THREE.MeshBasicMaterial({ color: 0xff0000 }),
            // Back face (green)
            new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
            // Top face (blue)
            new THREE.MeshBasicMaterial({ color: 0x0000ff }),
            // Bottom face (yellow)
            new THREE.MeshBasicMaterial({ color: 0xffff00 }),
            // Right face (magenta)
            new THREE.MeshBasicMaterial({ color: 0xff00ff }),
            // Left face (cyan)
            new THREE.MeshBasicMaterial({ color: 0x00ffff })
        ];

        const cube = new THREE.Mesh(new THREE.BoxGeometry(), materials);
        scene.add(cube);

        camera.position.z = 5;

        const animate = () => {
            requestAnimationFrame(animate);

            cube.rotation.x += (mouseY - cube.rotation.x) * 0.05;
            cube.rotation.y += (mouseX - cube.rotation.y) * 0.05;

            renderer.render(scene, camera);
        };

        const onMouseMove = (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        };

        animate();

        window.addEventListener('mousemove', onMouseMove);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            ref.current.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={ref}></div>;
};

export default ThreeDCube;