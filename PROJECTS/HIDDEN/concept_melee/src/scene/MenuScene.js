
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

export class MenuScene {
    constructor(scene) {
        this.scene = scene;
        this.loader = new SVGLoader();
        this.init();
    }

    init() {
        // Background Color
        this.scene.background = new THREE.Color(0x000020); // Deep blue

        // --- 1. Curved Grid Background ---
        // Large upright cylinder backdrop viewed from outside
        const gridGeometry = new THREE.CylinderGeometry(500, 500, 400, 64, 10, true);

        // Grid Shader
        const gridMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                gridColor: { value: new THREE.Color(0x808080) }, // Gray grid lines
                bgColor: { value: new THREE.Color(0x000020) } // Blue background
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform float time;
                uniform vec3 gridColor;
                uniform vec3 bgColor;

                void main() {
                    // Grid pattern - square grid cells
                    float scaleX = 150.0;
                    float scaleY = 300.0; // Higher to compensate for cylinder curvature
                    
                    // Scroll effect on Y
                    float scroll = time * 0.05;
                    
                    float gridX = step(0.97, fract(vUv.x * scaleX));
                    float gridY = step(0.97, fract(vUv.y * scaleY + scroll));
                    
                    float grid = max(gridX, gridY);
                    
                    // Mix grid color with background
                    vec3 color = mix(bgColor, gridColor, grid * 0.6);
                    
                    // Add a "horizon" glow
                    float glow = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    glow = pow(glow, 3.0);
                    
                    // 30% opacity
                    gl_FragColor = vec4(color, 0.3 - glow * 0.1);
                }
            `,
            transparent: true,
            side: THREE.FrontSide, // View from outside
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.grid = new THREE.Mesh(gridGeometry, gridMaterial);
        this.grid.position.z = -600; // Much farther back to fit large cylinder in view
        this.scene.add(this.grid);

        // --- 2. Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 5, 10);
        this.scene.add(dirLight);

        // --- 3. Menu Items (Gold Buttons) ---
        this.menuItems = [];
        const items = ["1-P Mode", "VS. Mode", "Trophies", "Options", "Data"];

        // Create a shared gradient texture for buttons
        this.buttonTexture = this.createGradientTexture();

        items.forEach((item, index) => {
            this.createMenuItem(item, index);
        });

        // --- 4. UI Frame (Blue Container) ---
        this.createUIFrame();

        // --- 5. Text Labels ---
        this.createHeaderText();
        this.createDescriptionPanel();
    }

    createHeaderText() {
        // "Main Menu" Header
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        ctx.fillStyle = '#8888ff'; // Light blue
        ctx.font = 'bold italic 50px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Main Menu', 20, 64);

        // Add underline/decor
        ctx.fillStyle = '#4444ff';
        ctx.fillRect(20, 90, 300, 5);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const geometry = new THREE.PlaneGeometry(8, 2);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-3, 4.5, 0.1); // Moved forward to prevent flickering
        this.scene.add(mesh);

        // Bottom Text "Solo Smash!"
        const botCanvas = document.createElement('canvas');
        const botCtx = botCanvas.getContext('2d');
        botCanvas.width = 512;
        botCanvas.height = 64;

        botCtx.fillStyle = 'white';
        botCtx.font = 'bold 40px Arial';
        botCtx.textAlign = 'center';
        botCtx.textBaseline = 'middle';
        botCtx.fillText('Solo Smash!', 256, 32);

        const botTexture = new THREE.CanvasTexture(botCanvas);
        const botMaterial = new THREE.MeshBasicMaterial({ map: botTexture, transparent: true });
        const botGeometry = new THREE.PlaneGeometry(8, 1);
        const botMesh = new THREE.Mesh(botGeometry, botMaterial);
        botMesh.position.set(0, -4.5, 0.1); // Moved forward to prevent flickering
        this.scene.add(botMesh);
    }

    createUIFrame() {
        // Create the blue wireframe container
        // Using LineSegments for a "tech" look

        const frameGroup = new THREE.Group();

        // Main Box
        const width = 12;
        const height = 10;
        const geometry = new THREE.BoxGeometry(width, height, 0.5);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.5 });
        const frame = new THREE.LineSegments(edges, material);

        frameGroup.add(frame);

        // Background panel (glassy)
        const planeGeo = new THREE.PlaneGeometry(width, height);
        const planeMat = new THREE.MeshBasicMaterial({
            color: 0x000044,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.z = -0.5;
        frameGroup.add(plane);

        frameGroup.position.z = -1; // Behind buttons
        this.scene.add(frameGroup);
    }

    createDescriptionPanel() {
        const group = new THREE.Group();

        // Panel Background
        const width = 5;
        const height = 6;
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color: 0x004488,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const panel = new THREE.Mesh(geometry, material);
        group.add(panel);

        // Text Content
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;

        ctx.fillStyle = '#aaddff';
        ctx.font = 'italic 30px Arial';
        ctx.textAlign = 'left';

        const lines = [
            "Regular Match",
            "Event Match",
            "Stadium",
            "Training"
        ];

        let y = 100;
        lines.forEach(line => {
            ctx.fillText(line, 50, y);
            y += 60;
        });

        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const textGeo = new THREE.PlaneGeometry(width, height);
        const textMesh = new THREE.Mesh(textGeo, textMaterial);
        textMesh.position.z = 0.1;
        group.add(textMesh);

        group.position.set(3.5, 0, -0.5);
        group.rotation.y = -0.2; // Slight angle
        this.scene.add(group);
    }

    createGradientTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Gold/Yellow Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#ffffaa'); // Light yellow top
        gradient.addColorStop(0.5, '#ffcc00'); // Gold middle
        gradient.addColorStop(1, '#aa6600'); // Darker gold bottom

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createMenuItem(text, index) {
        const group = new THREE.Group();

        // --- Button Shape (Skewed Rectangle) ---
        const width = 6;
        const height = 1.2;
        const skew = 0.5;

        const shape = new THREE.Shape();
        shape.moveTo(skew, height);       // Top Left
        shape.lineTo(width + skew, height); // Top Right
        shape.lineTo(width, 0);           // Bottom Right
        shape.lineTo(0, 0);               // Bottom Left
        shape.lineTo(skew, height);       // Close

        const extrudeSettings = {
            steps: 1,
            depth: 0.2,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 2
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Center geometry
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            map: this.buttonTexture,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.6,
            emissive: 0x221100
        });

        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        // --- Text ---
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        // Text Shadow/Outline
        context.shadowColor = "black";
        context.shadowBlur = 4;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;

        context.fillStyle = 'black';
        context.font = 'bold italic 60px Arial'; // Italic for speed/action feel
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const textGeometry = new THREE.PlaneGeometry(4, 1);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = 0.25; // In front of button
        textMesh.position.x = 0;
        group.add(textMesh);

        // --- Positioning ---
        // Staggered layout
        group.position.set(-2 + (index * 0.2), 3 - (index * 1.4), 0);

        // Add userData for interaction
        group.userData = {
            originalScale: new THREE.Vector3(1, 1, 1),
            isHovered: false
        };

        this.scene.add(group);
        this.menuItems.push(group);
    }

    update() {
        const time = performance.now() * 0.001;

        if (this.grid) {
            this.grid.material.uniforms.time.value = time;
        }

        // Animate buttons
        this.menuItems.forEach(item => {
            if (item.userData.isHovered) {
                // Pulse effect
                const scale = 1.1 + Math.sin(time * 10) * 0.02;
                item.scale.set(scale, scale, scale);
            } else {
                item.scale.lerp(item.userData.originalScale, 0.1);
            }
        });
    }

    onHover(object) {
        // Find the parent container (Group)
        let container = object;
        while (container.parent && container.parent.type !== 'Scene') {
            if (this.menuItems.includes(container)) break;
            container = container.parent;
        }

        if (this.menuItems.includes(container)) {
            if (!container.userData.isHovered) {
                container.userData.isHovered = true;
                document.body.style.cursor = 'pointer';
                // Play sound effect here if we had audio
            }
        }
    }

    onHoverOut(object) {
        // Find the parent container
        let container = object;
        while (container.parent && container.parent.type !== 'Scene') {
            if (this.menuItems.includes(container)) break;
            container = container.parent;
        }

        if (this.menuItems.includes(container)) {
            if (container.userData.isHovered) {
                container.userData.isHovered = false;
                document.body.style.cursor = 'default';
            }
        }
    }
}

