import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {ComputerChip} from "./actors/ComputerChip";
import {InstructionMemory} from "./actors/InstructionMemory";
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
        this.renderer.render(this.scene, this.camera);
    }

    private startGameLoop(): void {
        setInterval(() => {
                if (this.paused) return;
                this.gameActors.forEach(gameActor => {
                    gameActor.update()
                    gameActor.drawUpdate()
                });
                this.hud.update()
            },
            ComputerChip.ONE_SECOND / this.cpu.getClockFrequency());
    }

    private loadGame(): void {
        DrawUtils.drawGrid(this.scene)
        this.addGameActors();
        this.hud = new HUD(this).drawHUD();
    }

    private addGameActors(): void {
        const workingMemory = new WorkingMemory([-2, 0], this.scene, 1)
        const instructionMemory = new InstructionMemory([2, 0], this.scene, workingMemory, 1)
        const cpu = new CPU([0, 0], this.scene, instructionMemory, workingMemory, 2)
        this.cpu = cpu;
        this.gameActors.push(cpu, instructionMemory, workingMemory);
    }
}

new App();