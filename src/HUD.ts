import {Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {App} from "./app";

export class HUD {
    private static readonly COLORS: Map<string, MeshBasicMaterial> = new Map([
        ["BASE", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})],
        ["HOVER", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")})],
    ]);

    private static readonly TEXT_SIZE: number = 0.05;
    private static readonly ZOOM_FACTOR: number = 0.0001;
    private static readonly SCALE_FACTOR: number = 1.1;

    private raycaster = new Raycaster(); // mouse raycaster
    private mouse = new Vector2(); // mouse coordinates
    private mouseDown = false;
    private initialMousePosition = new Vector2();

    private pauseButtonMesh: Mesh; // the pause button
    private playButtonMesh: Mesh; // the play button
    private IPCMesh: Mesh;
    private IPSMesh: Mesh;
    private totalExecutedInstructions: Mesh;

    private scene: Scene;
    private cpu: CPU;
    private readonly camera: OrthographicCamera;
    private app: App;

    private isHoveringMesh: Map<Mesh, boolean> = new Map<Mesh, boolean>();
    private mouseClickEvents: Map<Function, Function> = new Map<Function, Function>();

    constructor(app: App) {
        this.scene = app.scene;
        this.cpu = app.cpu;
        this.camera = app.camera;
        this.app = app;
        this.addMouseClickEvents();
        app.document.addEventListener('click', this.onMouseClick.bind(this), false);
        app.document.addEventListener('mousemove', this.onMouseMove.bind(this), false);

        app.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
        app.renderer.domElement.addEventListener('mousemove', this.onMouseDrag);
        app.renderer.domElement.addEventListener('mouseup', this.onMouseUp);
        app.renderer.domElement.addEventListener('wheel', this.onMouseWheel);
    }

    public drawHUD(): HUD {
        const startY = this.topMiddle().y;
        const middleX = this.topMiddle().x;
        const padding = 0.2
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), middleX,
            startY,
            HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))
        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Total executed instructions: " + this.cpu.getAccumulatedInstructionCount(),
                middleX, startY + padding, HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))
        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpu.getIPS(), middleX, startY + 2 * padding,
            HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))

        this.scene.add(this.totalExecutedInstructions, this.IPCMesh, this.IPSMesh);

        this.drawPauseButton();
        this.addMouseHoverEvents();

        this.updateMeshScale();
        this.updateMeshPositions();
        return this;
    }

    update(): void {
        DrawUtils.updateText(this.IPCMesh, "IPC: " + this.cpu.getIPC());
        DrawUtils.updateText(this.totalExecutedInstructions,
            "Total executed instructions: " + this.cpu.getAccumulatedInstructionCount());
        DrawUtils.updateText(this.IPSMesh, "IPS: " + this.cpu.getIPS());
        this.updateMeshPositions();
    }

    updateMeshPositions(): void {
        const startY = this.topMiddle().y;
        const middleX = this.topMiddle().x;
        const padding = 0.1 / this.camera.zoom;
        this.IPCMesh.position.set(middleX, startY, 0);
        this.IPCMesh.geometry.center();
        this.totalExecutedInstructions.position.set(middleX, startY + padding, 0);
        this.totalExecutedInstructions.geometry.center();
        this.IPSMesh.position.set(middleX, startY + padding * 2, 0);
        this.IPSMesh.geometry.center();

        const startX = this.topRight().x;
        this.pauseButtonMesh.position.set(startX, this.topRight().y, 0);
        this.playButtonMesh.position.set(startX, this.topRight().y, 0);
    }

    private updateMeshScale(): void {
        const scale = 1 / this.camera.zoom;
        this.IPCMesh.scale.set(scale, scale, scale);
        this.totalExecutedInstructions.scale.set(scale, scale, scale);
        this.IPSMesh.scale.set(scale, scale, scale);
        this.pauseButtonMesh.scale.set(scale, scale, scale);
        this.playButtonMesh.scale.set(scale, scale, scale);
    }

    private topRight(): Vector2 {
        const startX = this.camera.position.x + (this.camera.right - 0.2) / this.camera.zoom;
        const startY = this.camera.position.y + (this.camera.top - 0.2) / this.camera.zoom;
        return new Vector2(startX, startY);
    }

    private topMiddle(): Vector2 {
        const startX = this.camera.position.x;
        const startY = this.camera.position.y + (this.camera.top - 0.3) / this.camera.zoom;
        return new Vector2(startX, startY);
    }

    private onMouseDown = (event: MouseEvent) => {
        this.mouseDown = true;
        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    private onMouseUp = () => {
        this.mouseDown = false;
    }

    private onMouseWheel = (event: WheelEvent) => {
        const delta = event.deltaY;

        // Adjust the camera zoom
        this.camera.zoom += delta * -HUD.ZOOM_FACTOR;
        this.camera.zoom = Math.max(0.5, this.camera.zoom); // prevent zooming too far in or out
        this.camera.updateProjectionMatrix();
        this.updateMeshPositions();
        this.updateMeshScale();
    }


    private drawPauseButton(): void {
        const startY = this.topRight().y;
        const startX = this.topRight().x;
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(
            0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        ).translateX(startX).translateY(startY).rotateZ(-Math.PI / 2);

        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(
            0.1, 0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        ).translateX(startX).translateY(startY);
        this.playButtonMesh.visible = false;

        this.scene.add(this.pauseButtonMesh, this.playButtonMesh);
    }

    private addMouseClickEvents(): void {
        this.mouseClickEvents.set(
            () => this.raycaster.intersectObject(this.pauseButtonMesh).concat(this.raycaster.intersectObject(this.playButtonMesh)).length > 0,
            () => this.togglePauseState()
        );
    }

    public togglePauseState(): void {
        this.app.paused = !this.app.paused;
        this.app.gameActors.forEach(actor => actor.togglePauseState());
        this.pauseButtonMesh.visible = !this.app.paused;
        this.playButtonMesh.visible = this.app.paused;
    }

    private addMouseHoverEvents(): void {
        this.isHoveringMesh.set(this.pauseButtonMesh, false);
        this.isHoveringMesh.set(this.playButtonMesh, false);
    }

    private updateMouseCoordinates(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    private onMouseClick(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.mouseClickEvents.forEach((callback, condition) => {
            if (condition()) callback()
        });
    }

    private onMouseDrag = (event: MouseEvent) => {
        if (!this.mouseDown) return;

        const deltaX = (event.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (event.clientY - this.initialMousePosition.y) / window.innerHeight;

        const scale = 2 / this.camera.zoom;

        this.camera.position.x -= deltaX * scale;
        this.camera.position.y += deltaY * scale;

        this.initialMousePosition.set(event.clientX, event.clientY);
        this.updateMeshPositions();
    }

    private onMouseMove(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
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
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("LIGHT"), HUD.SCALE_FACTOR);
    }

    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT"), 1);
    }
}