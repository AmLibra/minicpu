import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {GameActor} from "./actors/GameActor";

class App {
    private scene: Scene;
    private camera: OrthographicCamera;
    private renderer: WebGLRenderer;

    constructor() {
        this.init();
        this.animate();
    }

    private gameAcors: GameActor[] = [
        new CPU("CPU", [0, 0])
    ]

    private init(): void {
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.set(0, 0, 10); // Positioned along the Z-axis

        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARK"), 1);

        for (let gameActor of this.gameAcors) {
            gameActor.draw(this.scene);
        }

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
        this.renderer.render(this.scene, this.camera);
        this.gameAcors.forEach(gameActor => gameActor.update());
    }
}

new App();
