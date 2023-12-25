import {OrthographicCamera, Scene, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {ComputerChip} from "./actors/ComputerChip";
import {ROM} from "./actors/ROM";
import {MainMemory} from "./actors/MainMemory";

/**
 * This class is the entry point of the application.
 * It is responsible for initializing the scene and the game loop.
 *
 * @class App
 */
class App {
    private scene: Scene;
    private camera: OrthographicCamera;
    private renderer: WebGLRenderer;

    private gameActors: ComputerChip[] = []

    constructor() {
        this.init().then( () => {
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
        this.renderer = new WebGLRenderer({antialias: true, alpha: true}); // create the WebGL renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight); // set the size of the renderer to the window size
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARK"), 1); // set the background color of the scene
        document.body.appendChild(this.renderer.domElement); // add the renderer to the DOM

        const aspect = window.innerWidth / window.innerHeight; // set the aspect ratio of the camera

        // create an orthographic camera, positioned at (0, 0, 10) and pointing along the Z-axis
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 2);
        this.camera.position.set(0, 0, 2); // Positioned along the Z-axis
        // Zoom out a bit so that the entire scene is visible, do not forget to update the projection matrix!
        this.camera.zoom = 0.8;
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
            this.gameActors.forEach(gameActor => {
                gameActor.update()
                gameActor.drawUpdate()
            });
        }, ComputerChip.ONE_SECOND / CPU.CLOCK_SPEED);
    }

    /**
     * Loads the game.
     *
     * @private
     */
    private loadGame(): void {
        this.drawHUD();
        this.addGameActors();
    }

    /**
     * Draws the HUD of the game.
     *
     * @private
     */
    private drawHUD(): void {
        this.scene.add(
            DrawUtils.buildTextMesh("CPU clock: " + CPU.CLOCK_SPEED + "Hz", 0, 0.8,
                0.1, DrawUtils.COLOR_PALETTE.get("LIGHT"))
        );
    }

    /**
     * Adds the game actors to the scene.
     * The order in which the actors are added is important.
     * The CPU must be added first so that it can read from ROM and MainMemory.
     *
     * @private
     */
    private addGameActors(): void {
        const mainMemory = new MainMemory("MAIN_MEMORY0", [-1.5, 0], this.scene)
        const rom = new ROM("ROM0", [1.5, 0], this.scene)
        const cpu = new CPU("CPU0", [0, 0], this.scene, rom, mainMemory)
        cpu.setPipelined(true)

        this.gameActors.push(cpu);
        this.gameActors.push(rom);
        this.gameActors.push(mainMemory);
    }
}

new App();
