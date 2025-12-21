
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- CONFIGURATION ---
const PARAMS = {
    sensitivity: 1.2, friction: 0.97, momentumEase: 0.1, snappiness: 0.85,
    grassAttack: 0.05, grassDecay: 0.94, bendPower: 4.0, maxBend: 3.0,
    windSpeed: 1.2, keySpeed: 0.1,
    ballScale: 3.0, grassLength: 1.0, grassWidth: 1.0, skyTint: 0.3,
    transitionDuration: 1000, easeIntensity: 1.0,
    // Camera State
    camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0,
    activeSlot: 1,
    // FX
    usePostProcessing: true,
    distortion: 0.15,
    aberration: 0.002,
    scanlines: 0.05,
    noise: 0.03
};

const VISUALS = { baseColor: 0x5C4033, radius: 10, geoDetail: 5, grassCount: 150000, grassBaseSize: 0.3 };

const keyframes = {
    1: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    2: { camX: -100, camY: -100, camZ: 10, aimX: -33, aimY: 29, aimZ: 0 },
    3: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    4: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    5: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    6: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    7: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    8: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 },
    9: { camX: -24, camY: -44, camZ: 65, aimX: -33, aimY: 29, aimZ: 0 }
};

const PLANET_DATA = [
    { r: 1.5, color: 0xff3333, orbitR: 35, speed: 0.5, y: 6, name: "ENTRY 00", cat: "SYS" },
    { r: 1.2, color: 0x3388ff, orbitR: 42, speed: -0.3, y: -5, name: "ENTRY 01", cat: "DAT" },
    { r: 0.9, color: 0xffaa00, orbitR: 30, speed: 0.7, y: 14, name: "ENTRY 02", cat: "NET" },
    { r: 2.0, color: 0x9933ff, orbitR: 48, speed: 0.2, y: 0, name: "ENTRY 03", cat: "LOG" }
];
// --- UI LOGIC ---
const listEl = document.getElementById('project-list');
PLANET_DATA.forEach(p => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = "#";
    a.innerHTML = `${p.name} <span>${p.cat}</span>`;

    // Dismiss modal and return to main view on click
    a.addEventListener('click', (e) => {
        e.preventDefault();
        loadKeyframe(1);
        document.getElementById('side-panel').classList.remove('active');
    });

    li.appendChild(a);
    listEl.appendChild(li);
});

const panel = document.getElementById('side-panel');
const btnProjects = document.getElementById('btn-projects');
const btnContact = document.getElementById('btn-contact');
const btnClose = document.getElementById('btn-close-projects');

if (btnProjects) {
    btnProjects.addEventListener('click', () => {
        loadKeyframe(2);
        panel.classList.add('active');
    });
}

if (btnContact) {
    btnContact.addEventListener('click', () => {
        loadKeyframe(1);
        panel.classList.remove('active');
    });
}

if (btnClose) {
    btnClose.addEventListener('click', () => {
        loadKeyframe(1);
        panel.classList.remove('active');
    });
}

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Antialias false for post-processing usually
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; // Modern replacement for outputEncoding
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- CRT / DISTORTION SHADER ---
const DigitalDistortionShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'uTime': { value: 0.0 },
        'uDistortion': { value: PARAMS.distortion },
        'uAberration': { value: PARAMS.aberration },
        'uScanlines': { value: PARAMS.scanlines },
        'uNoise': { value: PARAMS.noise }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uDistortion;
        uniform float uAberration;
        uniform float uScanlines;
        uniform float uNoise;
        varying vec2 vUv;

        // Barrel Distortion
        vec2 distort(vec2 uv) {
            vec2 c = uv - 0.5;
            float r2 = dot(c, c);
            return c * (1.0 + uDistortion * r2) + 0.5;
        }

        // Random
        float random(vec2 uv) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            vec2 uv = distort(vUv);
            
            // Black out of bounds
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            // Chromatic Aberration
            vec2 rOff = vec2(uAberration, 0.0);
            vec2 bOff = vec2(-uAberration, 0.0);
            
            float r = texture2D(tDiffuse, uv + rOff).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv + bOff).b;

            vec3 color = vec3(r, g, b);

            // Scanlines
            float scan = sin(uv.y * 800.0 + uTime * 10.0) * 0.5 + 0.5;
            color *= 1.0 - uScanlines * (1.0 - scan);

            // Noise
            float grain = random(uv + uTime);
            color += (grain - 0.5) * uNoise;

            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const distortionPass = new ShaderPass(DigitalDistortionShader);
composer.addPass(distortionPass);


// --- LIGHTS ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(10, 30, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.radius = 4;
scene.add(dirLight);

// --- ORB & GRASS ---
const orbGroup = new THREE.Group();
orbGroup.scale.setScalar(PARAMS.ballScale);
scene.add(orbGroup);

const baseGeo = new THREE.IcosahedronGeometry(VISUALS.radius, VISUALS.geoDetail);
const dirtMat = new THREE.MeshStandardMaterial({ color: VISUALS.baseColor, roughness: 0.9 });
const baseMesh = new THREE.Mesh(baseGeo, dirtMat);
baseMesh.receiveShadow = true;
orbGroup.add(baseMesh);

let instancedGrass;
const grassGeo = new THREE.PlaneGeometry(0.05, 0.4);
grassGeo.translate(0, 0.2, 0);

const grassMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec2 vUv; uniform float uTime; uniform vec3 uRotVel; 
        uniform float uBendPower; uniform float uMaxBend; 
        uniform float uLength; uniform float uWidth;
        float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vUv = uv; vec3 pos = position;
            pos.y *= uLength; pos.x *= uWidth;
            float id = instanceMatrix[3][0]; 
            float rnd = rand(vec2(id, 1.0));
            pos.y *= (0.7 + rnd * 0.6); 
            vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
            vec3 moveDir = cross(uRotVel, worldPos.xyz);
            vec3 bend = -moveDir * uBendPower; 
            if (length(bend) > uMaxBend) bend = normalize(bend) * uMaxBend;
            float noise = sin(2.0 * worldPos.x + uTime * 2.0) * cos(2.0 * worldPos.z + uTime * 1.5);
            vec3 wind = vec3(noise * 0.05, 0.0, noise * 0.05);
            float flexibility = vUv.y * vUv.y; 
            worldPos.xyz += (bend + wind) * flexibility;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColorBottom; uniform vec3 uColorTop; void main() { gl_FragColor = vec4(mix(uColorBottom, uColorTop, vUv.y), 1.0); }`,
    uniforms: {
        uTime: { value: 0 }, uRotVel: { value: new THREE.Vector3(0, 0, 0) },
        uBendPower: { value: PARAMS.bendPower }, uMaxBend: { value: PARAMS.maxBend },
        uLength: { value: PARAMS.grassLength }, uWidth: { value: PARAMS.grassWidth },
        uColorBottom: { value: new THREE.Color(0x115500) }, uColorTop: { value: new THREE.Color(0x44cc00) }
    },
    side: THREE.DoubleSide
});

function initGrass() {
    if (instancedGrass) { orbGroup.remove(instancedGrass); instancedGrass.dispose(); }
    instancedGrass = new THREE.InstancedMesh(grassGeo, grassMaterial, VISUALS.grassCount);
    const dummy = new THREE.Object3D();
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();
    const upVec = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < VISUALS.grassCount; i++) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
        _pos.setFromSphericalCoords(VISUALS.radius, phi, theta);
        _quat.setFromUnitVectors(upVec, _pos.clone().normalize());
        _quat.multiply(new THREE.Quaternion().setFromAxisAngle(upVec, Math.random() * Math.PI * 2));
        dummy.position.copy(_pos); dummy.rotation.setFromQuaternion(_quat); dummy.scale.setScalar(1.0); dummy.updateMatrix();
        instancedGrass.setMatrixAt(i, dummy.matrix);
    }
    instancedGrass.instanceMatrix.needsUpdate = true;
    instancedGrass.receiveShadow = true;
    orbGroup.add(instancedGrass);
}
initGrass();

// --- PLANETS & UFO ---
const interactables = [];
PLANET_DATA.forEach((data) => {
    const geo = new THREE.SphereGeometry(data.r, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.2, metalness: 0.1, emissive: data.color, emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { angle: Math.random() * Math.PI * 2, orbitR: data.orbitR, speed: data.speed, y: data.y, color: new THREE.Color(data.color), type: 'planet', name: data.name, cat: data.cat };
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); interactables.push(mesh);
});

function createUFO() {
    const g = new THREE.Group();
    const matS = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.1 });
    const matG = new THREE.MeshStandardMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 0.3, 16), matS));
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), matG); d.position.y = 0.1; g.add(d);
    const l = new THREE.PointLight(0x00ffff, 1, 8); l.position.y = -0.5; g.add(l);
    g.userData = { angle: 0, orbitR: 25, speed: 0.8, y: 6, color: new THREE.Color(0x00ffff), type: 'ufo', name: "Contact", cat: "UFO" };
    scene.add(g); interactables.push(g); g.traverse(c => { if (c.isMesh) c.userData = g.userData; });
}
createUFO();

// --- LOGIC / CONTROLS ---
const clock = new THREE.Clock();
const gui = new GUI({ closed: true });
// Restore close button text shim not needed for lil-gui usually, but we can set title
// setTimeout(() => { const b = document.querySelector('.dg .close-button'); if (b) b.innerHTML = 'Controls'; }, 1000);

const camFolder = gui.addFolder('Camera & Layout');
camFolder.add(PARAMS, 'ballScale', 0.5, 5.0).name('Ball Size').onChange(v => orbGroup.scale.setScalar(v));
camFolder.add(PARAMS, 'camX', -100, 100).name('Cam X').listen();
camFolder.add(PARAMS, 'camY', -100, 100).name('Cam Y').listen();
camFolder.add(PARAMS, 'camZ', 10, 200).name('Cam Zoom').listen();
camFolder.add(PARAMS, 'aimX', -100, 100).name('Aim X (Pan)').listen();
camFolder.add(PARAMS, 'aimY', -100, 100).name('Aim Y (Tilt)').listen();
camFolder.add(PARAMS, 'skyTint', 0.0, 1.0).name('Sky Tint');

const fxFolder = gui.addFolder('Digital FX');
fxFolder.add(PARAMS, 'usePostProcessing').name('Enable FX');
fxFolder.add(PARAMS, 'distortion', 0.0, 1.0).name('Distortion').onChange(v => distortionPass.uniforms.uDistortion.value = v);
fxFolder.add(PARAMS, 'aberration', 0.0, 0.02).name('Aberration').onChange(v => distortionPass.uniforms.uAberration.value = v);
fxFolder.add(PARAMS, 'scanlines', 0.0, 0.5).name('Scanlines').onChange(v => distortionPass.uniforms.uScanlines.value = v);
fxFolder.add(PARAMS, 'noise', 0.0, 0.5).name('Noise').onChange(v => distortionPass.uniforms.uNoise.value = v);

const transFolder = gui.addFolder('Transitions');
transFolder.add(PARAMS, 'transitionDuration', 100, 5000).name('Duration (ms)');
transFolder.add(PARAMS, 'easeIntensity', 0.0, 3.0).name('Ease Overshoot');

const keyFolder = gui.addFolder('Keyframes');
keyFolder.add(PARAMS, 'activeSlot', [1, 2, 3, 4, 5, 6, 7, 8, 9]).name('Slot').listen();
keyFolder.add({ save: saveKeyframe }, 'save').name('Save View');
keyFolder.add({ export: exportAllSettings }, 'export').name('Export Settings');

const visFolder = gui.addFolder('Visuals');
visFolder.add(VISUALS, 'grassCount', 10000, 300000).step(1000).onFinishChange(initGrass);

const physFolder = gui.addFolder('Physics');
physFolder.add(PARAMS, 'sensitivity', 0.1, 3.0);
physFolder.add(PARAMS, 'keySpeed', 0.001, 0.1);

// Helper functions (formerly inline)
function saveKeyframe() {
    const s = PARAMS.activeSlot;
    keyframes[s] = {
        camX: parseFloat(PARAMS.camX.toFixed(1)), camY: parseFloat(PARAMS.camY.toFixed(1)), camZ: parseFloat(PARAMS.camZ.toFixed(1)),
        aimX: parseFloat(PARAMS.aimX.toFixed(1)), aimY: parseFloat(PARAMS.aimY.toFixed(1)), aimZ: parseFloat(PARAMS.aimZ.toFixed(1))
    };
    console.log(`Saved View to Slot ${s}`);
}

function exportAllSettings() {
    // Update PARAMS with current cam state before export
    PARAMS.camX = parseFloat(camera.position.x.toFixed(2));
    PARAMS.camY = parseFloat(camera.position.y.toFixed(2));
    PARAMS.camZ = parseFloat(camera.position.z.toFixed(2));

    let code = `// --- PASTE THIS OVER THE CONFIGURATION BLOCK ---\n\n`;
    code += `const PARAMS = ${JSON.stringify(PARAMS, null, 4)};\n\n`;
    code += `const VISUALS = ${JSON.stringify(VISUALS, null, 4)};\n\n`;
    code += `const keyframes = ${JSON.stringify(keyframes, null, 4)};\n\n`;

    console.log("%c📋 SETTINGS EXPORT:", "color: #00ff00; font-weight: bold; font-size: 14px;");
    console.log(code);
    alert("All Settings exported to Console (F12). Copy/Paste to save.");
}

// Keyframe Loader
let cameraTween = null;
function loadKeyframe(slot) {
    const target = keyframes[slot];
    if (!target) return;
    PARAMS.activeSlot = slot;
    cameraTween = {
        start: { camX: PARAMS.camX, camY: PARAMS.camY, camZ: PARAMS.camZ, aimX: PARAMS.aimX, aimY: PARAMS.aimY, aimZ: PARAMS.aimZ },
        end: target, startTime: performance.now(), duration: PARAMS.transitionDuration
    };
}
// Expose to window for external button clicks
window.loadKeyframe = loadKeyframe;

// Easing
function customEase(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const elTooltip = document.getElementById('tooltip');
const elTitle = document.getElementById('tp-title'), elCat = document.getElementById('tp-cat'), elColor = document.getElementById('tp-color');
let hoveredObj = null;
const keys = {};
let targetGrassColorTop = new THREE.Color(0x44cc00);
let targetGrassColorBottom = new THREE.Color(0x115500);
let targetDirtColor = new THREE.Color(VISUALS.baseColor);
let orbVel = { x: 0, y: 0 }, grassVel = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') { const g = document.querySelector('.lil-gui'); if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none'; }
    if (e.key >= '1' && e.key <= '9') loadKeyframe(parseInt(e.key));
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => keys[e.key] = false);
window.addEventListener('mousemove', (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; });
window.addEventListener('click', () => {
    if (hoveredObj) {
        targetGrassColorTop.copy(hoveredObj.userData.color);
        targetDirtColor.copy(hoveredObj.userData.color);
        targetGrassColorBottom.copy(hoveredObj.userData.color).multiplyScalar(0.2);

        const force = 0.15 * PARAMS.sensitivity;
        orbVel.x += -mouse.y * force;
        orbVel.y += mouse.x * force;
    }
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    // FX Update
    distortionPass.uniforms.uTime.value = time;

    // Colors
    const colorLerpFactor = 0.2;
    grassMaterial.uniforms.uColorTop.value.lerp(targetGrassColorTop, colorLerpFactor);
    grassMaterial.uniforms.uColorBottom.value.lerp(targetGrassColorBottom, colorLerpFactor);
    dirtMat.color.lerp(targetDirtColor, colorLerpFactor);

    // Tween
    if (cameraTween) {
        let t = (performance.now() - cameraTween.startTime) / cameraTween.duration;
        if (t >= 1) { t = 1; cameraTween = null; }
        const eT = customEase(t);
        PARAMS.camX = THREE.MathUtils.lerp(cameraTween.start.camX, cameraTween.end.camX, eT);
        PARAMS.camY = THREE.MathUtils.lerp(cameraTween.start.camY, cameraTween.end.camY, eT);
        PARAMS.camZ = THREE.MathUtils.lerp(cameraTween.start.camZ, cameraTween.end.camZ, eT);
        PARAMS.aimX = THREE.MathUtils.lerp(cameraTween.start.aimX, cameraTween.end.aimX, eT);
        PARAMS.aimY = THREE.MathUtils.lerp(cameraTween.start.aimY, cameraTween.end.aimY, eT);
        PARAMS.aimZ = THREE.MathUtils.lerp(cameraTween.start.aimZ, cameraTween.end.aimZ, eT);
    }
    camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
    camera.lookAt(PARAMS.aimX, PARAMS.aimY, PARAMS.aimZ);

    // Physics
    let kx = 0, ky = 0;
    if (keys.ArrowUp || keys.w) kx = -PARAMS.keySpeed; if (keys.ArrowDown || keys.s) kx = PARAMS.keySpeed;
    if (keys.ArrowLeft || keys.a) ky = -PARAMS.keySpeed; if (keys.ArrowRight || keys.d) ky = PARAMS.keySpeed;

    if (kx !== 0 || ky !== 0) {
        orbGroup.rotation.x += kx; orbGroup.rotation.y += ky;
        orbVel.x = kx; orbVel.y = ky;
    } else {
        orbVel.x *= PARAMS.friction; orbVel.y *= PARAMS.friction;
        orbGroup.rotation.x += orbVel.x; orbGroup.rotation.y += orbVel.y;
    }

    grassVel.x = THREE.MathUtils.lerp(grassVel.x, orbVel.x, PARAMS.grassAttack);
    grassVel.y = THREE.MathUtils.lerp(grassVel.y, orbVel.y, PARAMS.grassAttack);
    grassVel.x *= PARAMS.grassDecay; grassVel.y *= PARAMS.grassDecay;
    grassMaterial.uniforms.uRotVel.value.set(grassVel.x * 50.0, grassVel.y * 50.0, 0);
    grassMaterial.uniforms.uTime.value = time * PARAMS.windSpeed;

    // Raycast
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables, true);
    let found = null;
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        found = (obj.parent && obj.parent.userData.type === 'ufo') ? obj.parent : obj;
    }
    hoveredObj = found;
    document.body.style.cursor = hoveredObj ? 'pointer' : 'default';

    if (hoveredObj) {
        elTooltip.classList.add('visible');
        if (window.innerWidth > 768) {
            const vec = new THREE.Vector3(); hoveredObj.getWorldPosition(vec); vec.project(camera);
            const x = (vec.x * 0.5 + 0.5) * window.innerWidth; const y = (-(vec.y * 0.5) + 0.5) * window.innerHeight;
            elTooltip.style.left = `${x + 20}px`; elTooltip.style.top = `${y - 60}px`;
        } else {
            elTooltip.style.left = ''; elTooltip.style.top = '';
        }

        const tid = hoveredObj.uuid;
        if (elTooltip.dataset.target !== tid) {
            elTooltip.dataset.target = tid; elTitle.innerText = hoveredObj.userData.name || "Unknown"; elCat.innerText = hoveredObj.userData.cat || "Project"; elColor.style.backgroundColor = '#' + hoveredObj.userData.color.getHexString();
        }
    } else { elTooltip.classList.remove('visible'); elTooltip.dataset.target = ''; }

    interactables.forEach(obj => {
        const d = obj.userData;
        const ts = (obj === hoveredObj) ? 1.5 : 1.0;
        obj.scale.lerp(new THREE.Vector3(ts, ts, ts), 0.1);
        if (obj !== hoveredObj) { d.angle += d.speed * dt; if (d.type === 'ufo') obj.rotation.y += 2 * dt; }
        else { if (d.type === 'ufo') obj.rotation.y += 10 * dt; }
        obj.position.x = Math.cos(d.angle) * d.orbitR; obj.position.z = Math.sin(d.angle) * d.orbitR; obj.position.y = d.y + Math.sin(time + d.orbitR) * 0.5;
    });

    if (PARAMS.usePostProcessing) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}
animate();
