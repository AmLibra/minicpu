import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {SISDProcessor} from "./actors/SISDProcessor";
import {ComputerChip} from "./actors/ComputerChip";
import {InstructionMemory} from "./actors/InstructionMemory";
import {WorkingMemory} from "./actors/WorkingMemory";
import {HUD} from "./HUD";

/**
 * Main application class responsible for initializing and managing the game state,
 * including the rendering pipeline, scene setup, and game loop.
 */
export class App {
    /** The number of milliseconds in a second, used for app timing. */
    public static readonly ONE_SECOND: number = 1000;

    /** The main scene where all objects are placed. */
    scene: Scene = new Scene();

    /** Renderer for drawing the scene onto the canvas. */
    renderer: WebGLRenderer;

    /** Camera to view the scene. */
    camera: OrthographicCamera;

    /** Flag to pause the game loop. */
    paused: boolean = false;

    /** Central Processing Unit (CPU) simulation. */
    cpu: SISDProcessor;

    /** Collection of all computer chip actors within the simulation. */
    gameActors: ComputerChip[] = [];

    /** Heads-Up Display (HUD) for showing game information. */
    private hud: HUD;

    constructor() {
        this.loadResources().then(() => {
            this.renderer = this.setupRenderer();
            this.setupCamera();
            this.loadGame();
            this.animate();
            this.startGameLoop();
        });
    }

    /**
     * Asynchronously loads required resources before starting the application.
     */
    private async loadResources(): Promise<void> {
        await DrawUtils.loadFont();
    }

    /**
     * Sets up the WebGL renderer with appropriate settings.
     *
     * @returns {WebGLRenderer} The configured renderer.
     */
    private setupRenderer(): WebGLRenderer {
        this.renderer = new WebGLRenderer({antialias: true, alpha: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARKEST"), 1);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.autoClear = false;
        document.body.appendChild(this.renderer.domElement);
        return this.renderer;
    }

    /**
     * Initializes the camera used to view the scene.
     */
    private setupCamera(): void {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
        this.camera.position.set(0, 0, 2);
        this.camera.zoom = 0.4;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Animation loop for rendering the scene and HUD.
     */
    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.hud.getHUDScene(), this.hud.getHUDCamera());
    }

    /**
     * Starts the main game loop with updates based on the CPU's clock frequency.
     */
    private startGameLoop(): void {
        setInterval(() => {
            if (this.paused) return;
            this.gameActors.forEach(actor => actor.update());
            this.hud.update();
        }, App.ONE_SECOND / this.cpu.getClockFrequency());
    }

    /**
     * Loads and initializes game dataStructures like the HUD and game actors.
     */
    private loadGame(): void {
        this.addGameActors();
        this.hud = new HUD(this);
        DrawUtils.drawGrid(this.scene)
    }

    /**
     * Adds game actors like the CPU and memory modules to the simulation.
     */
    private addGameActors(): void {
        const workingMemory = new WorkingMemory([0, -2.8], this.scene, 3, 8, 4, 8);
        const instructionMemory = new InstructionMemory([2.5, 0.1], this.scene, workingMemory, 2, 32);
        // instruction memory speed should be less than CPU speed / 4
        const cpu = new SISDProcessor([0, 0], this.scene, instructionMemory, workingMemory, 20,
            6);
        this.cpu = cpu;
        this.gameActors.push(cpu, instructionMemory, workingMemory);
    }
}

new App();