import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {ComputerChip} from "./actors/ComputerChip";
import {ROM} from "./actors/ROM";
import {MainMemory} from "./actors/MainMemory";

class App {
    private scene: Scene;
    private camera: OrthographicCamera;
    private renderer: WebGLRenderer;

    private gameActors: ComputerChip[] = []



    constructor() {
        this.init();
        this.animate();
        this.startGameLoop()
    }

    private init(): void {
        this.scene = new Scene();

        DrawUtils.onFontLoaded(() => {
            this.scene.add(
                DrawUtils.drawText("CPU clock: " + CPU.CLOCK_SPEED + "Hz", 0, 0.8,
                    0.1, DrawUtils.COLOR_PALETTE.get("LIGHT"))
            );
        });

        const mainMemory = new MainMemory("MAIN_MEMORY0", [-1.5, 0], this.scene)
        const rom = new ROM("ROM0", [1.5, 0], this.scene)
        const cpu = new CPU("CPU0", [0, 0], this.scene, rom, mainMemory)

        cpu.setPipelined(true)
        this.gameActors.push(cpu);
        this.gameActors.push(rom); // CPU must be pushed first so that it can't instantly read from ROM
        this.gameActors.push(mainMemory);

        this.renderer = new WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARK"), 1);
        document.body.appendChild(this.renderer.domElement);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.set(0, 0, 10); // Positioned along the Z-axis
        // zoom out
        this.camera.zoom = 0.8;
        this.camera.updateProjectionMatrix();

        for (let gameActor of this.gameActors)
            gameActor.draw();

        window.addEventListener('resize', () => { // browser window resize handler
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
        }, ComputerChip.ONE_SECOND / CPU.CLOCK_SPEED);
    }
}

new App();
