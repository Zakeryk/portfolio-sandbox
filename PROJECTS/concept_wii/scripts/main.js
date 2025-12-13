import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js';

// --- CONFIGURATION ---
const PARAMS = {
    // Camera / Transition
    transitionDuration: 1000,
    camX: 0, camY: -1.5, camZ: 10,
    aimX: 0, aimY: -1.5, aimZ: 0,
    camZoom: 2.7,
    
    // Grid Layout
    gridSpacing: 1.5,
    gridOffsetX: 0.0,
    gridOffsetY: -1.5,
    
    // Visuals
    borderRadius: 0.018,
    bgColor: 0xe0e0e0,
    activeSlot: 1
};

// --- STATE MANAGEMENT ---
const cursorState = {
    x: 0, y: 0,
    prevX: 0, 
    targetX: 0, targetY: 0,
    angle: 0,
    scale: 1, targetScale: 1
};

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let INTERSECTED = null;
let cameraTween = null;

// --- SCENE SETUP ---
const container = document.getElementById('canvas-wrapper');
const scene = new THREE.Scene();

// Camera
const baseSize = 5;
const aspect = container.clientWidth / container.clientHeight;
const camera = new THREE.OrthographicCamera(
    -aspect * baseSize, aspect * baseSize,
    baseSize, -baseSize,
    0.1, 1000
);
camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
camera.zoom = PARAMS.camZoom;
camera.updateProjectionMatrix();

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio); 
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 10);
scene.add(directionalLight);

// Raycasting
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// --- BORDER LOGIC (Straight Line Fix) ---
function updateCurvedBorder() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const borderPath = document.getElementById('border-path');
    const maskPath = document.getElementById('mask-path');
    
    // Adjust this value to move the line up/down
    const baselineY = height * 0.85; 
    const inset = 0; // Set to 0 for full width

    // STRAIGHT LINE PATH
    // Moves to left, draws straight line to right, then closes box for mask
    const d = `
        M ${inset},${baselineY}
        L ${width - inset},${baselineY}
        L ${width - inset},0
        L ${inset},0
        Z
    `;

    if (borderPath) {
        borderPath.setAttribute('d', d);
        // We only want to stroke the bottom line, not the whole box
        // But SVG paths stroke the whole perimeter.
        // VISUAL TRICK: We draw the line separately for the border stroke
        // and the box for the mask.
        
        // For the visible blue line (just a single line across):
        const lineOnly = `M 0,${baselineY} L ${width},${baselineY}`;
        borderPath.setAttribute('d', lineOnly);
    }
    
    if (maskPath) {
        // The mask needs to be a closed shape (the white area above the line)
        maskPath.setAttribute('d', d);
    }
}

// --- GRID GENERATION ---
const COLS = 4;
const ROWS = 3;
const TOTAL_BLOCKS = COLS * ROWS;
const BLOCK_WIDTH = 1.4;
const BLOCK_HEIGHT = 0.9;
const channelBlocks = [];

function createChannelBlock(index) {
    const geometry = new RoundedBoxGeometry(BLOCK_WIDTH, BLOCK_HEIGHT, 0.2, 4, PARAMS.borderRadius);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, 
        specular: 0x555555, 
        shininess: 40 
    });
    const block = new THREE.Mesh(geometry, material);
    block.userData.index = index;
    return block;
}

for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const block = createChannelBlock(i);
    scene.add(block);
    channelBlocks.push(block);
}

function updateLayout() {
    const gap = PARAMS.gridSpacing - BLOCK_WIDTH;
    const spacingY = gap + BLOCK_HEIGHT;
    const totalWidth = (COLS - 1) * PARAMS.gridSpacing;
    const totalHeight = (ROWS - 1) * spacingY;
    const xOffset = -totalWidth / 2 + PARAMS.gridOffsetX;
    const yOffset = totalHeight / 2 + PARAMS.gridOffsetY;

    channelBlocks.forEach((block, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        block.position.x = xOffset + col * PARAMS.gridSpacing;
        block.position.y = yOffset - row * spacingY;
        block.position.z = 0;
    });
}
updateLayout();

// --- INPUT HANDLING ---
window.addEventListener('resize', () => {
    const aspect = container.clientWidth / container.clientHeight;
    camera.left = -aspect * baseSize;
    camera.right = aspect * baseSize;
    camera.top = baseSize;
    camera.bottom = -baseSize;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    updateCurvedBorder();
});

window.addEventListener('mousedown', (e) => {
    if (INTERSECTED) {
        cursorState.targetScale = 0.85; 
        return; 
    }
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    cursorState.targetScale = 0.85; 
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    cursorState.targetScale = INTERSECTED ? 1.3 : 1.0; 
});

window.addEventListener('mousemove', (e) => {
    // 1. Instant Cursor Tracking
    cursorState.targetX = e.clientX;
    cursorState.targetY = e.clientY;
    
    // 2. Camera Panning
    if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        
        const sensitivity = 0.002 * PARAMS.camZoom;
        PARAMS.camX -= deltaX * sensitivity;
        PARAMS.camY += deltaY * sensitivity;
    }

    // 3. Raycaster Pointer Update
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
});

// --- CLOCK ---
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        clockEl.innerHTML = `${hours}:${strMinutes} <span style="font-size: 0.6em;">${ampm}</span>`;
    }
}
setInterval(updateClock, 1000);
updateClock();
updateCurvedBorder();

// --- KEYFRAMES ---
const keyframes = {
    1: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    2: { camX: 1.5, camY: -0.5, camZ: 10, aimX: 1.5, aimY: -0.5, aimZ: 0 },
    3: { camX: 0, camY: 0, camZ: 15, aimX: 0, aimY: 0, aimZ: 0 }
};

function easeOutExpo(x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }

function loadKeyframe(slot) {
    const target = keyframes[slot];
    if (!target) return;
    cameraTween = {
        start: { camX: PARAMS.camX, camY: PARAMS.camY, camZ: PARAMS.camZ, aimX: PARAMS.aimX, aimY: PARAMS.aimY, aimZ: PARAMS.aimZ },
        end: target, 
        startTime: performance.now(), 
        duration: PARAMS.transitionDuration
    };
}

window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') loadKeyframe(parseInt(e.key));
    if (e.key === '`') { 
        const g = document.querySelector('.dg.ac'); 
        if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none'; 
    }
});

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (cameraTween) {
        let t = (performance.now() - cameraTween.startTime) / cameraTween.duration;
        if (t >= 1) { t = 1; cameraTween = null; }
        const eT = easeOutExpo(t);
        
        PARAMS.camX = THREE.MathUtils.lerp(cameraTween.start.camX, cameraTween.end.camX, eT);
        PARAMS.camY = THREE.MathUtils.lerp(cameraTween.start.camY, cameraTween.end.camY, eT);
        PARAMS.camZ = THREE.MathUtils.lerp(cameraTween.start.camZ, cameraTween.end.camZ, eT);
        PARAMS.aimX = THREE.MathUtils.lerp(cameraTween.start.aimX, cameraTween.end.aimX, eT);
        PARAMS.aimY = THREE.MathUtils.lerp(cameraTween.start.aimY, cameraTween.end.aimY, eT);
        PARAMS.aimZ = THREE.MathUtils.lerp(cameraTween.start.aimZ, cameraTween.end.aimZ, eT);
    }

    camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
    camera.lookAt(PARAMS.aimX, PARAMS.aimY, PARAMS.aimZ);

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(channelBlocks, false);

    if (intersects.length > 0) {
        const closestBlock = intersects[0].object;
        if (INTERSECTED !== closestBlock) {
            if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            INTERSECTED = closestBlock;
            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
            INTERSECTED.material.emissive.setHex(0x444444);
            if (!isDragging) cursorState.targetScale = 1.3;
        }
        closestBlock.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.15);
    } else {
        if (INTERSECTED) {
            INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            INTERSECTED = null;
            if (!isDragging) cursorState.targetScale = 1.0;
        }
    }
    
    channelBlocks.forEach(block => { 
        if (block !== INTERSECTED) block.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.1); 
    });

    renderer.render(scene, camera);
}
animate();

// --- CURSOR PHYSICS LOOP (FIXED ALIGNMENT) ---
const cursorEl = document.getElementById('custom-cursor');

function animateCursor() {
    // 1. Instant Position (Hotspot Fixed)
    // We apply the coordinates directly. Ensure CSS 'transform-origin' is '0 0' (top-left).
    cursorState.x = cursorState.targetX;
    cursorState.y = cursorState.targetY;

    // 2. Rubber Band Scale
    cursorState.scale += (cursorState.targetScale - cursorState.scale) * 0.2;

    // 3. Velocity Tilt 
    if (cursorState.prevX === undefined) cursorState.prevX = cursorState.x;
    
    const dx = cursorState.x - cursorState.prevX;
    cursorState.prevX = cursorState.x;

    const targetAngle = dx * 2.5; 
    cursorState.angle += (targetAngle - cursorState.angle) * 0.1;

    if(cursorEl) {
        // No centering offset here. We assume top-left of image is the pointer tip.
        // Rotation naturally pivots around that top-left tip because of CSS transform-origin: 0 0;
        cursorEl.style.transform = `
            translate3d(${cursorState.x}px, ${cursorState.y}px, 0) 
            rotate(${cursorState.angle}deg) 
            scale(${cursorState.scale})
        `;
    }
    requestAnimationFrame(animateCursor);
}
animateCursor();

// --- GUI ---
const gui = new GUI({ closed: true });
gui.hide();
const folder = gui.addFolder('Grid');
folder.add(PARAMS, 'gridSpacing', 1, 3).onChange(updateLayout);
folder.add(PARAMS, 'gridOffsetY', -5, 5).onChange(updateLayout);
folder.add(PARAMS, 'camZoom', 0.1, 5).onChange(v => { camera.zoom = v; camera.updateProjectionMatrix(); });