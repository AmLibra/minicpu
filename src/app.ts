import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {GameActor} from "./actors/GameActor";
import {ROM} from "./actors/ROM";

class App {
    private scene: Scene;
    private camera: OrthographicCamera;
    private renderer: WebGLRenderer;

    constructor() {
        this.init();
        this.animate();
        this.startGameLoop()
    }

    private gameActors: GameActor[] = [
    ]

    private init(): void {
        this.scene = new Scene();
        const rom = new ROM([0.6, 0], this.scene)
        const cpu = new CPU("CPU", [0, 0], this.scene, rom)
        this.gameActors.push(rom, cpu);
        this.renderer = new WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARK"), 1);
        document.body.appendChild(this.renderer.domElement);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.set(0, 0, 10); // Positioned along the Z-axis


        for (let gameActor of this.gameActors)
            gameActor.draw();

        // browser window resize handler
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
    }

    private startGameLoop(): void {
        setInterval(() => {
            this.gameActors.forEach(gameActor => gameActor.update());
        }, 1000 / CPU.CLOCK_SPEED);
    }
}

new App();
