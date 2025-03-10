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
    private static readonly ONE_SECOND: number = 1000;
    private static readonly FPS: number = 60;
    private static frameCount: number = 0;

    // CPU initial parameters
    private static readonly CPU_POSITION: [number, number] = [0, 0];
    private static readonly CPU_CLOCK_FREQUENCY: number = 30;
    private static readonly CPU_CACHE_SIZE: number = 6;

    // Instruction Memory initial parameters
    private static readonly INSTRUCTION_MEMORY_CLOCK_FREQUENCY: number = 5;
    private static readonly INSTRUCTION_MEMORY_DELAY: number = 3;
    private static readonly INSTRUCTION_MEMORY_SIZE: number = 32;

    // Memory initial parameters
    private static readonly MEMORY_CLOCK_FREQUENCY: number = 5;
    private static readonly MEMORY_BANKS: number = 12;
    private static readonly MEMORY_WORDS_PER_BANK: number = 16;

    /** The main scene where all objects are placed. */
    scene: Scene = new Scene();

    /** Renderer for drawing the scene onto the canvas. */
    renderer: WebGLRenderer;

    /** Camera to view the scene. */
    camera: OrthographicCamera;

    /** Flag to pause the game loop. */
    paused: boolean = false;

    /** Central Processing Unit (CPU) simulation. */
    cpus: SISDProcessor[] = [];

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
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARKEST")!, 1);
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
        this.camera.position.set(0, 0.8, 2);
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

            this.gameActors.forEach(actor => {
                const frameInterval = Math.round(App.FPS / actor.getClockFrequency());
                if (App.frameCount % frameInterval === 0)
                    actor.update();
            });

            this.hud.update();
            App.frameCount++;
        }, App.ONE_SECOND / App.FPS);
    }

    /**
     * Loads and initializes game dataStructures like the HUD and game actors.
     */
    private loadGame(): void {
        this.addGameActors();
        if (this.cpus.length === 0)
            throw new Error("No CPUs found in the simulation.");
        this.hud = new HUD(this);
        DrawUtils.drawGrid(this.scene)
    }

    /**
     * Adds game actors like the CPU and memory modules to the simulation.
     */
    private addGameActors(): void {
        const workingMemory = new WorkingMemory(this, App.MEMORY_CLOCK_FREQUENCY, App.MEMORY_BANKS, App.MEMORY_WORDS_PER_BANK);
        const workingMemorySize = App.MEMORY_BANKS * App.MEMORY_WORDS_PER_BANK;
        const instructionMemory = new InstructionMemory(this, App.INSTRUCTION_MEMORY_CLOCK_FREQUENCY,
            App.INSTRUCTION_MEMORY_DELAY, workingMemorySize, App.INSTRUCTION_MEMORY_SIZE);
        const cpu = new SISDProcessor(App.CPU_POSITION, this.scene, App.CPU_CLOCK_FREQUENCY, App.CPU_CACHE_SIZE);
        // sleep for a bit to allow the CPU to initialize
        cpu.connectToInstructionMemory(instructionMemory);
        cpu.connectToWorkingMemory(workingMemory);

        this.cpus.push(cpu);
        this.gameActors.push(cpu, instructionMemory, workingMemory);
    }

    /**
     * Removes a game actor from the simulation.
     */
    public removeGameActor(actor: ComputerChip): void {
        const index = this.gameActors.indexOf(actor);
        if (index > -1) {
            this.gameActors.splice(index, 1);
        }
    }
}

new App();