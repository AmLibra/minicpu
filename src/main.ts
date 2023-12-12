import * as THREE from 'three';

class Main {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private square: THREE.Mesh;

    constructor() {
        this.init();
        this.animate();
    }

    private init(): void {
        // Scene setup
        this.scene = new THREE.Scene();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Orthographic Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.set(0, 0, 10); // Positioned along the Z-axis

        // Background color
        this.renderer.setClearColor(0x000000, 1); // Black background

        // Square
        const geometry = new THREE.PlaneGeometry(1, 1); // 1x1 plane
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF }); // White color
        this.square = new THREE.Mesh(geometry, material);
        this.scene.add(this.square);

        // Resize handler
        window.addEventListener('resize', () => {
            const aspect = window.innerWidth / window.innerHeight;
            this.camera.left = -aspect;
            this.camera.right = aspect;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

new Main();
