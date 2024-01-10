import {Material, Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2, WebGLRenderer} from "three";
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
    camera: OrthographicCamera;
    paused: boolean = false;
    document: Document;
    cpu: CPU;
    gameActors: ComputerChip[] = []

    private renderer: WebGLRenderer;
    private hud: HUD;

    constructor() {
        this.init().then(() => {
                this.animate();
                this.startGameLoop()
            }
        )
    }

    /**
     * Initializes the scene and the game.
     *
     * @private
     */
    private async init(): Promise<void> {
        this.scene = new Scene(); // create the scene
        this.document = document;
        this.renderer = new WebGLRenderer({antialias: true, alpha: true}); // create the WebGL renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight); // set the size of the renderer to the window size
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARKEST"), 1); // set the background color of the scene
        document.body.appendChild(this.renderer.domElement); // add the renderer to the DOM

        const aspect = window.innerWidth / window.innerHeight; // set the aspect ratio of the camera

        // create an orthographic camera,
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
        this.camera.position.set(0, 0, 2); // Positioned along the Z-axis
        // Zoom out a bit so that the entire scene is visible, do not forget to update the projection matrix!
        this.camera.zoom = 0.6;
        this.camera.updateProjectionMatrix();

        // add a listener for the window resize event to update the camera and renderer size accordingly
        window.addEventListener('resize', () => {
            const aspectRatio = window.innerWidth / window.innerHeight;
            this.camera.left = -aspectRatio;
            this.camera.right = aspectRatio;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Load the font and start the game
        try {
            await DrawUtils.loadFont();
            DrawUtils.drawGrid(this.scene)
            this.loadGame();
        } catch (error) {
            throw new Error("Could not load font: " + error);
        }
    }

    /**
     * The main animation loop.
     *
     * @private
     */
    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Starts the game loop.
     *
     * @private
     */
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

    /**
     * Loads the game.
     *
     * @private
     */
    private loadGame(): void {
        this.addGameActors();
        this.hud = new HUD(this).drawHUD();
    }

    /**
     * Adds the game actors to the scene.
     * The order in which the actors are added is important.
     * The CPU must be added first so that it can read from ROM and MainMemory.
     *
     * @private
     */
    private addGameActors(): void {
        const workingMemory = new WorkingMemory([-2, 0], this.scene, 0.58)
        const instructionMemory = new InstructionMemory([2, 0], this.scene, workingMemory, 0.58)
        const cpu = new CPU([0, 0], this.scene, instructionMemory, workingMemory, 2.4)
        this.cpu = cpu;
        this.cpu.setPipelined();
        this.gameActors.push(cpu, instructionMemory, workingMemory);
    }
}

new App();