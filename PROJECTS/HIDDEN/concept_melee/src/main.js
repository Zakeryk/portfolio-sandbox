import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { MenuScene } from './scene/MenuScene.js';
import * as dat from 'dat.gui';

// Global Error Handler
window.onerror = function (message, source, lineno, colno, error) {
  const versionInfo = document.getElementById('version-info');
  if (versionInfo) {
    versionInfo.innerText = `Error: ${message} at ${lineno}:${colno}`;
    versionInfo.style.color = 'red';
    versionInfo.style.backgroundColor = 'black';
  }
  console.error(error);
};

console.log('Main.js starting...');
console.log('Window size:', window.innerWidth, window.innerHeight);

// Update version info to confirm JS is running
const versionInfo = document.getElementById('version-info');
if (versionInfo) {
  versionInfo.innerText = 'v0.0.1 - JS Active';
}

// Init Scene
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0xff0000); // Bright RED background for debugging
// console.log('Scene background set to RED');

scene.fog = new THREE.FogExp2(0x000000, 0.002);

// Init Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4.89e-16, 8);
camera.lookAt(0, 0, 0);
console.log('Camera initialized at', camera.position);

// Init Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
console.log('Renderer created', renderer.domElement);
document.querySelector('#app').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // Default to disabled for parallax

window.addEventListener('keydown', (event) => {
  if (event.code === 'Backquote') { // Tilde key
    controls.enabled = !controls.enabled;

    const displayStyle = controls.enabled ? 'block' : 'none';
    if (guiContainer) {
      guiContainer.style.display = displayStyle;
    }

    if (versionInfo) {
      versionInfo.style.display = displayStyle;
    }
    console.log('Controls enabled:', controls.enabled);
  }
});

// Post Processing
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 0.5; // Lower strength
bloomPass.radius = 0.5; // Some radius

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Menu Scene Content
const menuScene = new MenuScene(scene);
// const geometry = new THREE.BoxGeometry();
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);
// console.log('Green cube added to scene');

// Resize Handler
window.addEventListener('resize', () => {
  console.log('Resize event');
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Debug GUI
// Debug GUI
const gui = new dat.GUI({ autoPlace: false });
const guiContainer = document.getElementById('gui-container');
if (guiContainer) {
  guiContainer.appendChild(gui.domElement);
}

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(bloomPass, 'threshold', 0.0, 1.0).onChange((value) => { bloomPass.threshold = Number(value); });
bloomFolder.add(bloomPass, 'strength', 0.0, 3.0).onChange((value) => { bloomPass.strength = Number(value); });
bloomFolder.add(bloomPass, 'radius', 0.0, 1.0).onChange((value) => { bloomPass.radius = Number(value); });
bloomFolder.open();

const cameraFolder = gui.addFolder('Camera');
const camPos = cameraFolder.addFolder('Position');
camPos.add(camera.position, 'x').listen();
camPos.add(camera.position, 'y').listen();
camPos.add(camera.position, 'z').listen();
camPos.open();

const camRot = cameraFolder.addFolder('Rotation');
camRot.add(camera.rotation, 'x').listen();
camRot.add(camera.rotation, 'y').listen();
camRot.add(camera.rotation, 'z').listen();
camRot.open();

cameraFolder.open();

// Mouse Interaction
const mouse = new THREE.Vector2();
const targetRotation = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hoveredObject = null;

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

let frameCount = 0;

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  frameCount++;
  if (versionInfo) {
    versionInfo.innerText = `Frames: ${frameCount}`;
  }

  // Parallax Effect (only if controls are disabled)
  if (!controls.enabled) {
    targetRotation.x = mouse.y * 0.05;
    targetRotation.y = mouse.x * 0.05;

    camera.rotation.x += (targetRotation.x - camera.rotation.x) * 0.05;
    camera.rotation.y += (targetRotation.y - camera.rotation.y) * 0.05;
  } else {
    controls.update();
  }

  // Raycasting
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(menuScene.scene.children, true);

  if (intersects.length > 0) {
    if (hoveredObject !== intersects[0].object) {
      if (hoveredObject) menuScene.onHoverOut(hoveredObject);
      hoveredObject = intersects[0].object;
      menuScene.onHover(hoveredObject);
    }
  } else {
    if (hoveredObject) {
      menuScene.onHoverOut(hoveredObject);
      hoveredObject = null;
    }
  }

  // controls.update(); // Disable orbit controls for now to allow parallax
  menuScene.update();

  // renderer.render(scene, camera); // Direct render for debugging
  composer.render();
}

animate();
