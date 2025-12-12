import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// --- CONFIGURATION BLOCK ---
const PARAMS = {
    transitionDuration: 1000,
    easeIntensity: 1.0,
    camX: 0, camY: -1.5, camZ: 10, aimX: 0, aimY: -1.5, aimZ: 0,
    activeSlot: 1,
    bgColor: 0xe0e0e0,

    // Layout Defaults
    gridSpacing: 1.42, // Horizontal Center-to-Center
    gridOffsetX: 0.0,
    gridOffsetY: -1.2,
    borderRadius: 0.02, // Tighter corners
    camZoom: 2.7 // Closer default
};

const keyframes = {
    1: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    2: { camX: 1.5, camY: -0.5, camZ: 10, aimX: 1.5, aimY: -0.5, aimZ: 0 },
    3: { camX: 0, camY: 0, camZ: 15, aimX: 0, aimY: 0, aimZ: 0 },
    4: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    5: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    6: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    7: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    8: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 },
    9: { camX: 0, camY: 0, camZ: 10, aimX: 0, aimY: 0, aimZ: 0 }
};

// --- Tweening ---
let cameraTween = null;

function saveKeyframe() {
    const s = PARAMS.activeSlot;
    keyframes[s] = {
        camX: parseFloat(camera.position.x.toFixed(2)),
        camY: parseFloat(camera.position.y.toFixed(2)),
        camZ: parseFloat(camera.position.z.toFixed(2)),
        aimX: PARAMS.aimX, aimY: PARAMS.aimY, aimZ: PARAMS.aimZ
    };
    console.log(`Saved View to Slot ${s}`);
}

function loadKeyframe(slot) {
    const target = keyframes[slot];
    if (!target) return;
    PARAMS.activeSlot = slot;
    cameraTween = {
        start: { camX: PARAMS.camX, camY: PARAMS.camY, camZ: PARAMS.camZ, aimX: PARAMS.aimX, aimY: PARAMS.aimY, aimZ: PARAMS.aimZ },
        end: target, startTime: performance.now(), duration: PARAMS.transitionDuration
    };
}

function easeOutExpo(x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }
function updateBackgroundColor(color) { renderer.setClearColor(color); }

// --- Curved Border Drawing ---
function updateCurvedBorder() {
    const panel = document.getElementById('primary-panel');
    const borderPath = document.getElementById('border-path');
    if (!panel || !borderPath) return;

    const rect = panel.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate tab shape with more gradual curves
    const baselineY = height * 0.75;
    const tabBottomY = height * 0.95;

    // Inset by half stroke width to keep border within panel bounds
    const strokeWidth = 3;
    const inset = strokeWidth / 2;

    // Create tab path with gradual transitions
    const d = `
        M ${inset},${baselineY}
        L ${width * 0.1},${baselineY}
        C ${width * 0.13},${baselineY} ${width * 0.18},${height * 0.82} ${width * 0.25},${tabBottomY - inset}
        L ${width * 0.75},${tabBottomY - inset}
        C ${width * 0.82},${height * 0.82} ${width * 0.87},${baselineY} ${width * 0.9},${baselineY}
        L ${width - inset},${baselineY}
    `;

    borderPath.setAttribute('d', d);
}


// --- Grid Constants ---
const COLS = 4;
const ROWS = 3;
const TOTAL_BLOCKS = COLS * ROWS;
const BLOCK_WIDTH = 1.4;
const BLOCK_HEIGHT = 0.9;
const channelBlocks = [];

// --- Setup ---
const scene = new THREE.Scene();
const baseSize = 5;
const container = document.getElementById('canvas-wrapper');
const aspect = container.clientWidth / container.clientHeight;

const camera = new THREE.OrthographicCamera(
    -aspect * baseSize, aspect * baseSize,
    baseSize, -baseSize,
    0.1, 1000
);

camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
camera.zoom = PARAMS.camZoom;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
// updateBackgroundColor(PARAMS.bgColor); // Let CSS handle bg
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 10);
scene.add(directionalLight);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let INTERSECTED = null;

// --- Logic ---
function createChannelBlock(index) {
    const geometry = new RoundedBoxGeometry(BLOCK_WIDTH, BLOCK_HEIGHT, 0.2, 4, PARAMS.borderRadius);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x555555, shininess: 40 });
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
    // GAP LOGIC:
    // GapX = SpacingX - Width
    // We want GapY = GapX
    // SpacingY = GapX + Height

    const gap = PARAMS.gridSpacing - BLOCK_WIDTH;
    const spacingY = gap + BLOCK_HEIGHT;

    // Recalculate offsets to keep centered
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

function updateGeometry() {
    const newGeo = new RoundedBoxGeometry(BLOCK_WIDTH, BLOCK_HEIGHT, 0.2, 4, PARAMS.borderRadius);
    channelBlocks.forEach(block => {
        block.geometry.dispose();
        block.geometry = newGeo;
    });
}

updateLayout();

// --- GUI ---
const gui = new dat.GUI({ closed: true });
gui.domElement.parentElement.style.display = 'none';
setTimeout(() => { const b = document.querySelector('.dg .close-button'); if (b) b.innerHTML = 'Controls'; }, 1000);

const camFolder = gui.addFolder('Camera View');
camFolder.add(PARAMS, 'camX', -10, 10).listen();
camFolder.add(PARAMS, 'camY', -5, 5).listen();
camFolder.add(PARAMS, 'camZoom', 0.5, 5.0).name('Zoom').onChange(v => { camera.zoom = v; camera.updateProjectionMatrix(); }).listen();

const keyFolder = gui.addFolder('Keyframes');
keyFolder.add(PARAMS, 'activeSlot', [1, 2, 3, 4, 5, 6, 7, 8, 9]).listen();
keyFolder.add({ save: saveKeyframe }, 'save').name('Save View');
keyFolder.add(PARAMS, 'transitionDuration', 100, 3000).name('Duration (ms)');

const visFolder = gui.addFolder('Visuals');
visFolder.addColor(PARAMS, 'bgColor').name('Background').onChange(updateBackgroundColor);

const addSmartInput = (ctrl) => {
    const input = ctrl.domElement.querySelector('input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent triggering global hotkeys (like '1') while typing
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const val = ctrl.getValue();
                const step = 0.1;
                ctrl.setValue(parseFloat((e.key === 'ArrowUp' ? val + step : val - step).toFixed(2)));
            }
        });
    }
    return ctrl;
};

// Note: "Grid Spacing" now controls horizontal spacing; vertical is auto-matched
addSmartInput(visFolder.add(PARAMS, 'gridSpacing', 1.0, 3.0).name('Grid Spacing').onChange(updateLayout));
addSmartInput(visFolder.add(PARAMS, 'gridOffsetX', -5.0, 5.0, 0.01).name('Grid Offset X').onChange(updateLayout));
addSmartInput(visFolder.add(PARAMS, 'gridOffsetY', -5.0, 5.0, 0.01).name('Grid Offset Y').onChange(updateLayout));
visFolder.add(PARAMS, 'borderRadius', 0.0, 0.3).name('Border Radius').onChange(updateGeometry);
visFolder.open();

// --- Events ---
window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') { const g = document.querySelector('.dg.ac'); if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none'; }
    if (e.key >= '1' && e.key <= '9') loadKeyframe(parseInt(e.key));
});

// --- Panning ---
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

window.addEventListener('mousedown', (e) => {
    // Only pan if not clicking on the GUI or an interactive element (optional refinement)
    // For now, simple global pan
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        previousMousePosition = { x: e.clientX, y: e.clientY };

        // Adjust sensitivity based on zoom or fixed
        const sensitivity = 0.002 * PARAMS.camZoom;
        // Dragging moves the camera opposite to the drag direction to create "pan" effect
        PARAMS.camX -= deltaX * sensitivity;
        PARAMS.camY += deltaY * sensitivity;
    }

    // Update pointer for raycasting relative to the container
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    }
});

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

// --- Clock ---
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = hours + ':' + strMinutes + ' <span style="font-size: 0.6em;">' + ampm + '</span>';

    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.innerHTML = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// Initialize curved border
updateCurvedBorder();


// --- Loop ---
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
        for (var i in camFolder.__controllers) camFolder.__controllers[i].updateDisplay();
    }

    camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
    camera.lookAt(PARAMS.aimX, PARAMS.aimY, PARAMS.aimZ);

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(channelBlocks, false);

    if (intersects.length > 0) {
        const closestBlock = intersects[0].object;
        if (INTERSECTED != closestBlock) {
            if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
            INTERSECTED = closestBlock;
            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
            INTERSECTED.material.emissive.setHex(0x444444);
        }
        closestBlock.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.15);
        const cursor = document.getElementById('custom-cursor');
        if (cursor) cursor.classList.add('hovering');
    } else {
        const cursor = document.getElementById('custom-cursor');
        if (cursor) cursor.classList.remove('hovering');
        if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
        INTERSECTED = null;
    }
    channelBlocks.forEach(block => { if (block !== INTERSECTED) block.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.1); });

    renderer.render(scene, camera);
}
animate();