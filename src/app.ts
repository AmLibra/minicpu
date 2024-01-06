import {Material, Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2, WebGLRenderer} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {ComputerChip} from "./actors/ComputerChip";
import {InstructionMemory} from "./actors/InstructionMemory";
import {WorkingMemory} from "./actors/WorkingMemory";

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

    private raycaster = new Raycaster(); // mouse raycaster
    private mouse = new Vector2(); // mouse coordinates

    private gameActors: ComputerChip[] = []
    private cpu: CPU;

    private pauseButtonMesh: Mesh; // the pause button
    private playButtonMesh: Mesh; // the play button
    private isHoveringMesh: Map<Mesh, boolean> = new Map<Mesh, boolean>();
    private mouseClickEvents: Map<Function, Function> = new Map<Function, Function>();

    private IPCMesh: Mesh;

    private paused: boolean = false;

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
        this.renderer = new WebGLRenderer({antialias: true, alpha: true}); // create the WebGL renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight); // set the size of the renderer to the window size
        this.renderer.setClearColor(DrawUtils.COLOR_PALETTE.get("DARKEST"), 1); // set the background color of the scene
        document.body.appendChild(this.renderer.domElement); // add the renderer to the DOM

        const aspect = window.innerWidth / window.innerHeight; // set the aspect ratio of the camera

        // create an orthographic camera,
        this.camera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
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
            DrawUtils.drawGrid(this.scene)
            this.loadGame();
            this.addMouseClickEvents()
            document.addEventListener('click', (event) => this.onMouseClick(event), false);
            this.addMouseHoverEvents()
            document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        } catch (error) {
            throw new Error("Could not load font: " + error);
        }
    }

    private addMouseClickEvents(): void {
        this.mouseClickEvents.set(
            () => this.raycaster.intersectObject(this.pauseButtonMesh).concat(this.raycaster.intersectObject(this.playButtonMesh)).length > 0,
            () => this.togglePauseState()
        );
    }

    private addMouseHoverEvents(): void {
        this.isHoveringMesh.set(this.pauseButtonMesh, false);
        this.isHoveringMesh.set(this.playButtonMesh, false);
    }

    private togglePauseState(): void {
        this.paused = !this.paused;
        this.pauseButtonMesh.visible = !this.paused;
        this.playButtonMesh.visible = this.paused;
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
            this.IPCMesh.geometry.dispose();
            (this.IPCMesh.material as Material).dispose();
            this.scene.remove(this.IPCMesh);
            this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), 0, 0.8,
                0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")}))
            this.scene.add(this.IPCMesh);
        }, ComputerChip.ONE_SECOND / CPU.clockFrequency);
    }

    /**
     * Loads the game.
     *
     * @private
     */
    private loadGame(): void {
        this.addGameActors();
        this.drawHUD();
    }

    /**
     * Draws the HUD of the game.
     *
     * @private
     */
    private drawHUD(): void {
        this.scene.add(  // clock speed text
            DrawUtils.buildTextMesh("CPU clock: " + CPU.clockFrequency + " Hz", 0, 1,
                0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")}))
        );

        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), 0, 0.8,
                0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")}))
        this.scene.add(this.IPCMesh);

        // pause button
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(
            0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        );
        this.pauseButtonMesh.translateX(1.5).translateY(1).rotateZ(-Math.PI / 2);
        this.scene.add(this.pauseButtonMesh);

        // play button
        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(
            0.1, 0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        );
        this.playButtonMesh.visible = false;
        this.playButtonMesh.translateX(1.5).translateY(1);
        this.scene.add(this.playButtonMesh);
    }

    private onMouseClick(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.mouseClickEvents.forEach((callback, condition) => {
            if (condition()) callback()
        });
    }

    private onMouseMove(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.checkHoverState();
    }

    private checkHoverState(): void {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.isHoveringMesh.forEach((_isHovering, mesh) => this.updateHoverStateForMesh(mesh));
    }

    private updateHoverStateForMesh(mesh: Mesh): void {
        const intersected = this.raycaster.intersectObject(mesh).length > 0;
        const wasHovering = this.isHoveringMesh.get(mesh) || false;

        if (intersected && !wasHovering)
            this.onHoverEnter(mesh);
        else if (!intersected && wasHovering)
            this.onHoverLeave(mesh);
    }

    private onHoverEnter(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, true);
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("LIGHT"), 1.1);
    }

    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT"), 1);
    }

    /**
     * Adds the game actors to the scene.
     * The order in which the actors are added is important.
     * The CPU must be added first so that it can read from ROM and MainMemory.
     *
     * @private
     */
    private addGameActors(): void {
        const mainMemory = new WorkingMemory("MAIN_MEMORY0", [-1.5, 0], this.scene)
        const rom = new InstructionMemory("ROM0", [1.5, 0], this.scene)
        const cpu = new CPU("CPU0", [0, 0], this.scene, rom, mainMemory)
        this.cpu = cpu;
        CPU.clockFrequency = 2.5;

        this.gameActors.push(cpu, rom, mainMemory);
    }
}

new App();
