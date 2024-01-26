import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {ComputerChip} from "./actors/ComputerChip";
import {RAM} from "./actors/RAM";
import {WorkingMemory} from "./actors/WorkingMemory";
import {HUD} from "./HUD";

/**
 * This class is the entry point of the application.
 * It is responsible for initializing the scene and the game loop.
 *
 * @class App
 */
export class App {
    scene: Scene;
    renderer: WebGLRenderer;
    camera: OrthographicCamera;
    paused: boolean = false;
    cpu: CPU;
    gameActors: ComputerChip[] = []

    private hud: HUD;

    constructor() {
        this.init().then(() => {
                this.animate();
                this.startGameLoop()
            }
        )
    }

    private async init(): Promise<void> {
        this.scene = new Scene();
        this.renderer = this.setupRenderer();
        this.setupCamera();

        await DrawUtils.loadFont();
        this.loadGame();
    }

    private setupRenderer(): WebGLRenderer {
        this.renderer = new WebGLRenderer({antialias: true, alpha: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight); // set the size of the renderer to the window size
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARKEST"), 1); // set the background color of the scene
        this.renderer.setPixelRatio(window.devicePixelRatio); // set the pixel ratio to the device pixel ratio
        this.renderer.autoClear = false; // Allows HUD to be on top of the scene
        document.body.appendChild(this.renderer.domElement);
        return this.renderer;
    }

    private setupCamera(): void {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
        this.camera.position.set(0, 0, 2); // Positioned along the Z-axis
        this.camera.zoom = 0.6;
        this.camera.updateProjectionMatrix();
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());

        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.hud.getHUDScene(), this.hud.getHUDCamera());
    }

    private startGameLoop(): void {
        setInterval(() => {
                if (this.paused)
                    return;
                this.gameActors.forEach(gameActor => {
                    gameActor.update()
                    gameActor.drawUpdate()
                });
                this.hud.update()
            },
            ComputerChip.ONE_SECOND / this.cpu.getClockFrequency());
    }

    private loadGame(): void {
        this.addGameActors();
        this.hud = new HUD(this).drawHUD();
    }

    private addGameActors(): void {
        const workingMemory = new WorkingMemory([0, -1.2], this.scene, 5, 4, 3)
        const instructionMemory = new RAM([1.7, 0], this.scene, workingMemory, 2.5, 16) // RAM speed must be STRICTLY slower than cpu speed by a factor of 2
        const cpu = new CPU([0, 0], this.scene, instructionMemory, workingMemory, 5)
        this.cpu = cpu;
        this.cpu.setPipelined();
        this.gameActors.push(cpu, instructionMemory, workingMemory);
    }
}

new App();