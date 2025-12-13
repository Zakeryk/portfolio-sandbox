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
    prevX: 0, // Used for velocity calculation since position is instant
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
renderer.setPixelRatio(window.devicePixelRatio); // Crucial for crisp edges
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

// --- CURVED BORDER LOGIC (Unified Path) ---
function updateCurvedBorder() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // We target both the mask path (inside <defs>) and the visible border path
    const borderPath = document.getElementById('border-path');
    const maskPath = document.getElementById('mask-path');
    
    const baselineY = height * 0.75;
    const tabBottomY = height * 0.96; 
    const inset = 1.5; // Half of stroke width (3px)

    // Quadratic Bezier curves for smooth "Nintendo" style geometry
    const d = `
        M ${inset},${baselineY}
        L ${width * 0.12},${baselineY}
        Q ${width * 0.22},${baselineY} ${width * 0.28},${height * 0.88}
        L ${width * 0.32},${tabBottomY}
        Q ${width * 0.38},${height} ${width * 0.5},${height}
        Q ${width * 0.62},${height} ${width * 0.68},${tabBottomY}
        L ${width * 0.72},${height * 0.88}
        Q ${width * 0.78},${baselineY} ${width * 0.88},${baselineY}
        L ${width - inset},${baselineY}
        L ${width - inset},0
        L ${inset},0
        Z
    `;

    if (borderPath) borderPath.setAttribute('d', d);
    if (maskPath) maskPath.setAttribute('d', d);
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
    // If we are hovering a tile, do NOT start dragging the camera
    if (INTERSECTED) {
        cursorState.targetScale = 0.85; // Click Shrink on tile
        return; 
    }

    // Otherwise, drag the background
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    cursorState.targetScale = 0.85; // Click Shrink on BG
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    // If hovering a tile, return to "hover" size (1.3), otherwise normal (1.0)
    cursorState.targetScale = INTERSECTED ? 1.3 : 1.0; 
});

window.addEventListener('mousemove', (e) => {
    // 1. Instant Cursor Tracking (No delay)
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
updateCurvedBorder(); // Init border

// --- KEYFRAMES / TWEENING ---
const keyframes = {
    1: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    2: { camX: 1.5, camY: -0.5, camZ: 10, aimX: 1.5, aimY: -0.5, aimZ: 0 },
    3: { camX: 0, camY: 0, camZ: 15, aimX: 0, aimY: 0, aimZ: 0 }
    // Add more if needed
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

    // 1. Handle Camera Tween
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

    // 2. Raycasting (Hover Effects)
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(channelBlocks, false);

    if (intersects.length > 0) {
        const closestBlock = intersects[0].object;
        if (INTERSECTED !== closestBlock) {
            // Restore previous block
            if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            
            // Set new block
            INTERSECTED = closestBlock;
            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
            INTERSECTED.material.emissive.setHex(0x444444);
            
            // Mouse Interaction: If not currently clicking/dragging, expand cursor
            if (!isDragging) cursorState.targetScale = 1.3;
        }
        // Animate block scale up
        closestBlock.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.15);
    } else {
        if (INTERSECTED) {
            INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            INTERSECTED = null;
            
            // Mouse Interaction: If not clicking, return to normal cursor
            if (!isDragging) cursorState.targetScale = 1.0;
        }
    }
    
    // Animate blocks scaling back down
    channelBlocks.forEach(block => { 
        if (block !== INTERSECTED) block.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.1); 
    });

    renderer.render(scene, camera);
}
animate();

// --- CURSOR PHYSICS LOOP ---
const cursorEl = document.getElementById('custom-cursor');

function animateCursor() {
    // 1. Instant Position
    cursorState.x = cursorState.targetX;
    cursorState.y = cursorState.targetY;

    // 2. Rubber Band Scale (Lerp for smoothness)
    cursorState.scale += (cursorState.targetScale - cursorState.scale) * 0.2;

    // 3. Velocity Tilt 
    // Calculate velocity based on instant change from last frame
    if (cursorState.prevX === undefined) cursorState.prevX = cursorState.x;
    
    const dx = cursorState.x - cursorState.prevX;
    cursorState.prevX = cursorState.x;

    const targetAngle = dx * 2.5; // Multiplier for tilt intensity
    cursorState.angle += (targetAngle - cursorState.angle) * 0.1; // Smooth out the tilt

    if(cursorEl) {
        cursorEl.style.transform = `
            translate3d(${cursorState.x}px, ${cursorState.y}px, 0) 
            rotate(${cursorState.angle}deg) 
            scale(${cursorState.scale})
        `;
    }
    requestAnimationFrame(animateCursor);
}
animateCursor();

// --- DEBUG GUI (Optional) ---
const gui = new GUI({ closed: true });
gui.hide(); // Hidden by default, toggle with ` key
const folder = gui.addFolder('Grid');
folder.add(PARAMS, 'gridSpacing', 1, 3).onChange(updateLayout);
folder.add(PARAMS, 'gridOffsetY', -5, 5).onChange(updateLayout);
folder.add(PARAMS, 'camZoom', 0.1, 5).onChange(v => { camera.zoom = v; camera.updateProjectionMatrix(); });