import {Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {SISDProcessor} from "./actors/SISDProcessor";
import {App} from "./app";
import {ComputerChip} from "./actors/ComputerChip";

/**
 * Heads-Up Display (HUD) for showing game information.
 */
export class HUD {
    /** The base color for HUD elements. */
    private static readonly BASE_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    private static readonly HOVER_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    private static readonly MENU_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});
    /** The size of text in the HUD. */
    private static readonly TEXT_SIZE: number = 0.05;

    /** The layer for HUD elements. */
    private static MENU_LAYER: number = 0.1;

    /** The factor to zoom in or out by. */
    private static readonly ZOOM_FACTOR: number = 0.0001;
    /** The maximum zoom level. */
    private static readonly MAX_ZOOM: number = 0.5;
    /** The minimum zoom level. */
    private static readonly MIN_ZOOM: number = 1;
    /** The maximum camera position on the x-axis. */
    private static readonly MAX_CAMERA_POSITION_X = 2;
    /** The maximum camera position on the y-axis. */
    private static readonly MAX_CAMERA_POSITION_Y = 2;
    /** The speed at which the camera scrolls. */
    private static SCROLL_SPEED: number = 2;

    private static readonly HOVER_SCALE_FACTOR: number = 1.1;

    private raycaster = new Raycaster(); // mouse raycaster
    private mouse = new Vector2(); // mouse coordinates
    private mouseDown = false;
    private initialMousePosition = new Vector2();

    /** The HUD meshes. */
    private pauseButtonMesh: Mesh; // the pause button
    private playButtonMesh: Mesh; // the play button
    private IPCMesh: Mesh;
    private IPSMesh: Mesh;
    private totalExecutedInstructions: Mesh;

    /** The CPU to display information for. */
    private cpu: SISDProcessor;
    private readonly app: App;

    private selectedActor: ComputerChip;
    private isHoveringMesh: Map<Mesh, boolean> = new Map<Mesh, boolean>();
    private gameMouseClickEvents: Map<Function, Function> = new Map<Function, Function>();
    private hudMouseClickEvents: Map<Function, Function> = new Map<Function, Function>();

    /** The menu meshes. */
    private menuMesh: Mesh; // Menu mesh
    private menuTitleMesh: Mesh; // Menu title mesh
    private menuCloseMesh: Mesh; // Menu close mesh

    /** The HUD scene and camera. */
    private readonly hudScene: Scene;
    private readonly hudCamera: OrthographicCamera;

    /**
     * Initializes the HUD.
     *
     * @param app The application to display the HUD for.
     */
    constructor(app: App) {
        this.cpu = app.cpu;
        this.app = app;

        this.hudScene = new Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.hudCamera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
        this.hudCamera.position.set(0, 0, 2);

        this.addMouseClickEvents();

        document.addEventListener('click', this.onMouseClick.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseDrag);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('wheel', this.onMouseWheel);
        window.addEventListener('resize', () => this.onWindowResize());
        this.initialize();
    }

    /**
     * Returns the HUD scene.
     */
    public getHUDScene(): Scene {
        return this.hudScene;
    }

    /**
     * Returns the HUD camera.
     */
    public getHUDCamera(): OrthographicCamera {
        return this.hudCamera;
    }

    /**
     * Initializes the HUD.
     */
    private initialize(): HUD {
        this.drawStats();
        this.drawMenu();
        this.hudScene.add(this.totalExecutedInstructions, this.IPCMesh, this.IPSMesh, this.menuMesh, this.menuTitleMesh,
            this.menuCloseMesh);
        this.drawPauseButton();

        this.addMouseHoverEvents();
        return this;
    }

    /**
     * Updates the HUD.
     */
    public update(): void {
        DrawUtils.updateText(this.IPCMesh, "IPC: " + this.cpu.getIPC(), false);
        DrawUtils.updateText(this.totalExecutedInstructions, "Retired instructions: " + this.cpu.getAccRetiredInstructionsCount(), false);
        DrawUtils.updateText(this.IPSMesh, "IPS: " + this.cpu.getIPS(), false);
    }

    /**
     * Shows the menu for the selected actor.
     *
     * @private
     */
    private showMenu(): void {
        DrawUtils.updateText(this.menuTitleMesh, this.selectedActor ? this.selectedActor.displayName() : "undefined");
        this.menuTitleMesh.geometry.center();
        this.menuMesh.visible = true;
        this.menuTitleMesh.visible = true;
        if (this.menuCloseMesh)
            this.menuCloseMesh.visible = true;
    }

    /**
     * Hides the menu.
     *
     * @private
     */
    private hideMenu(): void {
        this.menuMesh.visible = false;
        this.menuTitleMesh.visible = false;
        this.menuCloseMesh.visible = false;
    }

    /**
     * Draws the statistics for the HUD.
     *
     * @private
     */
    private drawStats(): void {
        const textY = this.hudCamera.top - 0.3;
        const textX = this.hudCamera.left + 0.1;
        const padding = 0.1
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), textX, textY,
            HUD.TEXT_SIZE, HUD.BASE_COLOR, false)
        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpu.getIPS(), textX, textY + padding,
            HUD.TEXT_SIZE, HUD.BASE_COLOR, false)
        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Retired instructions: " + this.cpu.getAccRetiredInstructionsCount(),
                textX, textY + 2 * padding, HUD.TEXT_SIZE, HUD.BASE_COLOR, false);
    }

    /**
     * Draws the menu for the currently selected actor.
     *
     * @private
     */
    private drawMenu(): void {
        this.menuMesh = DrawUtils.buildQuadrilateralMesh(this.hudCamera.right * 2, this.hudCamera.top * 0.8, HUD.MENU_COLOR,
            new Vector2(this.hudCamera.position.x, this.hudCamera.position.y - this.hudCamera.top * 0.8)
        );
        this.menuMesh.visible = false;

        this.menuTitleMesh = DrawUtils.buildTextMesh("undefined", 0, this.hudCamera.bottom + 0.5,
            HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);
        this.menuTitleMesh.geometry.center();
        this.menuTitleMesh.visible = false;

        let closeMesh = this.menuCloseMesh;
        DrawUtils.buildImageMesh("res/close.png", 0.2, 0.2,
            (mesh: Mesh) => this.buildCloseMesh(mesh));
        this.menuCloseMesh = closeMesh;
    }

    /**
     * Builds the close mesh for the menu.
     * @param mesh The mesh to build.
     * @private
     */
    private buildCloseMesh(mesh: Mesh): void {
        mesh.position.set(this.hudCamera.right - 0.2, this.hudCamera.bottom + 0.55, HUD.MENU_LAYER);
        mesh.geometry.center();
        mesh.visible = false;
        this.menuCloseMesh = mesh;
        this.hudScene.add(mesh);
        this.hudMouseClickEvents.set(
            () => this.raycaster.intersectObject(this.menuCloseMesh).length > 0,
            () => this.hideMenu()
        );
    }

    /**
     * Draws the pause button for the HUD.
     *
     * @private
     */
    private drawPauseButton(): void {
        const startY = this.hudCamera.top - 0.1;
        const startX = this.hudCamera.right - 0.1;
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(0.1, HUD.BASE_COLOR)
            .translateX(startX).translateY(startY).rotateZ(-Math.PI / 2);

        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, HUD.BASE_COLOR,
            new Vector2(startX, startY));
        this.playButtonMesh.visible = false;

        this.hudScene.add(this.pauseButtonMesh, this.playButtonMesh);
    }

    /**
     * Adds mouse click events for the HUD.
     *
     * @private
     */
    private addMouseClickEvents(): void {
        this.hudMouseClickEvents.set(
            () => this.raycaster.intersectObject(this.pauseButtonMesh).concat(this.raycaster.intersectObject(this.playButtonMesh)).length > 0,
            () => this.togglePauseState()
        );

        this.app.gameActors.forEach(actor => {
            this.gameMouseClickEvents.set(
                () => this.raycaster.intersectObject(actor.getHitBoxMesh()).length > 0,
                () => {
                    if (this.selectedActor)
                        this.selectedActor = this.selectedActor.deselect();
                    this.selectedActor = actor.select()
                    this.showMenu();
                }
            );
        });
    }

    /**
     * Toggles the pause state of the game.
     *
     * @private
     */
    public togglePauseState(): void {
        this.app.paused = !this.app.paused;
        this.pauseButtonMesh.visible = !this.app.paused;
        this.playButtonMesh.visible = this.app.paused;
    }

    /**
     * Adds mouse hover events for the HUD.
     *
     * @private
     */
    private addMouseHoverEvents(): void {
        this.isHoveringMesh.set(this.pauseButtonMesh, false);
        this.isHoveringMesh.set(this.playButtonMesh, false);
    }

    /**
     * Handles the mouse down event.
     * @param event The mouse event.
     */
    private onMouseDown = (event: MouseEvent) => {
        this.mouseDown = true;
        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    /**
     * Handles the mouse up event.
     */
    private onMouseUp = () => {
        this.mouseDown = false;
    }

    /**
     * Handles the mouse wheel event.
     * @param event The mouse wheel event.
     */
    private onMouseWheel = (event: WheelEvent) => {
        this.app.camera.zoom += event.deltaY * -HUD.ZOOM_FACTOR;
        this.app.camera.zoom = Math.max(HUD.MAX_ZOOM, this.app.camera.zoom); // prevent zooming too far in
        this.app.camera.zoom = Math.min(HUD.MIN_ZOOM, this.app.camera.zoom); // prevent zooming too far out
        this.app.camera.updateProjectionMatrix();
    }

    /**
     * Handles the mouse drag event.
     * @param event The mouse drag event.
     */
    private onMouseDrag = (event: MouseEvent) => {
        if (!this.mouseDown) return;
        const deltaX = (event.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (event.clientY - this.initialMousePosition.y) / window.innerHeight;
        const aspectRatio = window.innerWidth / window.innerHeight;

        const scaleX = aspectRatio * HUD.SCROLL_SPEED / this.app.camera.zoom;
        const scaleY = HUD.SCROLL_SPEED / this.app.camera.zoom;

        this.app.camera.position.x -= deltaX * scaleX;
        this.app.camera.position.x = Math.max(-HUD.MAX_CAMERA_POSITION_X, this.app.camera.position.x);
        this.app.camera.position.x = Math.min(HUD.MAX_CAMERA_POSITION_X, this.app.camera.position.x);
        this.app.camera.position.y += deltaY * scaleY;
        this.app.camera.position.y = Math.max(-HUD.MAX_CAMERA_POSITION_Y, this.app.camera.position.y);
        this.app.camera.position.y = Math.min(HUD.MAX_CAMERA_POSITION_Y, this.app.camera.position.y);

        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    /**
     * Updates the mouse coordinates.
     * @param event The mouse event.
     * @private
     */
    private updateMouseCoordinates(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Handles the mouse click event.
     *
     * @param event The mouse event.
     * @private
     */
    private onMouseClick(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.raycaster.setFromCamera(this.mouse, this.app.camera);
        this.gameMouseClickEvents.forEach((executeCallback, condition) => {
            if (condition()) executeCallback()
        });
        this.raycaster.setFromCamera(this.mouse, this.hudCamera);
        this.hudMouseClickEvents.forEach((executeCallback, condition) => {
            if (condition()) executeCallback()
        });
    }

    /**
     * Handles the mouse move event.
     *
     * @param event
     * @private
     */
    private onMouseMove(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.checkHoverState();
    }

    /**
     * Checks the hover state of the mouse.
     * @private
     */
    private checkHoverState(): void {
        this.raycaster.setFromCamera(this.mouse, this.hudCamera);
        this.isHoveringMesh.forEach((wasHovering, mesh) => {
            const intersected = this.raycaster.intersectObject(mesh).length > 0;

            if (intersected && !wasHovering)
                this.onHoverEnter(mesh);
            else if (!intersected && wasHovering)
                this.onHoverLeave(mesh);
        });
    }

    /**
     * Handles the mouse entering a mesh.
     * @param mesh The mesh the mouse entered.
     * @private
     */
    private onHoverEnter(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, true);
        HUD.changeMeshAppearance(mesh, HUD.HOVER_COLOR, HUD.HOVER_SCALE_FACTOR);
    }

    /**
     * Handles the mouse leaving a mesh.
     *
     * @param mesh The mesh the mouse left.
     * @private
     */
    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        HUD.changeMeshAppearance(mesh, HUD.BASE_COLOR, 1);
    }

    /**
     * Handles the window resize event.
     *
     * @private
     */
    private onWindowResize(): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        this.app.camera.left = -aspectRatio;
        this.app.camera.right = aspectRatio;
        this.hudCamera.left = -aspectRatio;
        this.hudCamera.right = aspectRatio;

        this.app.camera.updateProjectionMatrix();
        this.hudCamera.updateProjectionMatrix();
        this.app.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Changes the appearance of a mesh.
     * @param mesh The mesh to change the appearance of.
     * @param color The new color of the mesh.
     * @param scale The new scale of the mesh.
     * @private
     */
    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}