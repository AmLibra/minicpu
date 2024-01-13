import {Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {App} from "./app";
import {ComputerChip} from "./actors/ComputerChip";

export class HUD {
    private static readonly BASE_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    private static readonly HOVER_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    private static readonly TEXT_SIZE: number = 0.05;

    private static readonly ZOOM_FACTOR: number = 0.0001;
    private static readonly MAX_ZOOM: number = 0.5;
    private static readonly MIN_ZOOM: number = 1;
    private static readonly HOVER_SCALE_FACTOR: number = 1.1;
    private static SCROLL_SPEED: number = 2;

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
    private selectedActor: ComputerChip;

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
        app.document.addEventListener('mousedown', this.onMouseDown);
        app.document.addEventListener('mousemove', this.onMouseDrag);
        app.document.addEventListener('mouseup', this.onMouseUp);
        app.document.addEventListener('wheel', this.onMouseWheel);
    }

    public drawHUD(): HUD {
        const startY = this.topLeft().y;
        const middleX = this.topLeft().x;
        const padding = 0.2
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), middleX,
            startY,
            HUD.TEXT_SIZE, HUD.BASE_COLOR)
        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Total executed instructions: " + this.cpu.getAccumulatedInstructionCount(),
                middleX, startY + padding, HUD.TEXT_SIZE, HUD.BASE_COLOR)
        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpu.getIPS(), middleX, startY + 2 * padding,
            HUD.TEXT_SIZE, HUD.BASE_COLOR)

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
    }

    private updateMeshPositions(): void {
        const startY = this.topLeft().y;
        const middleX = this.topLeft().x;
        const padding = 0.1 / this.camera.zoom;
        this.IPCMesh.position.set(middleX, startY, 0);
        this.totalExecutedInstructions.position.set(middleX, startY + padding, 0);
        this.IPSMesh.position.set(middleX, startY + padding * 2, 0);

        const startX = this.topRight().x;
        this.pauseButtonMesh.position.set(startX, this.topRight().y, 0);
        this.playButtonMesh.position.set(startX, this.topRight().y, 0);
    }

    private updateMeshScale(): void {
        const scale = this.getMeshScale();
        this.IPCMesh.scale.set(scale, scale, scale);
        this.totalExecutedInstructions.scale.set(scale, scale, scale);
        this.IPSMesh.scale.set(scale, scale, scale);
        this.pauseButtonMesh.scale.set(scale, scale, scale);
        this.playButtonMesh.scale.set(scale, scale, scale);
    }

    private getMeshScale(): number {
        return 1 / this.camera.zoom;
    }

    private topRight(): Vector2 {
        const startX = this.camera.position.x + (this.camera.right - 0.2) / this.camera.zoom;
        const startY = this.camera.position.y + (this.camera.top - 0.2) / this.camera.zoom;
        return new Vector2(startX, startY);
    }

    private topLeft(): Vector2 {
        const startX = this.camera.position.x + (this.camera.left + 0.1) / this.camera.zoom;
        const startY = this.camera.position.y + (this.camera.top - 0.3) / this.camera.zoom;
        return new Vector2(startX, startY);
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

        this.app.gameActors.forEach(actor => {
            this.mouseClickEvents.set(
                () => this.raycaster.intersectObject(actor.getHitboxMesh()).length > 0,
                () => this.selectedActor = actor.select()
            );
        });
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

    private onMouseDown = (event: MouseEvent) => {
        this.mouseDown = true;
        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    private onMouseUp = () => {
        this.mouseDown = false;
    }

    private onMouseWheel = (event: WheelEvent) => {
        this.camera.zoom += event.deltaY * -HUD.ZOOM_FACTOR;
        this.camera.zoom = Math.max(HUD.MAX_ZOOM, this.camera.zoom); // prevent zooming too far in
        this.camera.zoom = Math.min(HUD.MIN_ZOOM, this.camera.zoom); // prevent zooming too far out
        this.camera.updateProjectionMatrix();
        this.updateMeshPositions();
        this.updateMeshScale();
    }

    private onMouseDrag = (event: MouseEvent) => {
        if (!this.mouseDown || this.selectedActor) return;

        const deltaX = (event.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (event.clientY - this.initialMousePosition.y) / window.innerHeight;
        const aspectRatio = window.innerWidth / window.innerHeight;

        const scaleX = aspectRatio * HUD.SCROLL_SPEED / this.camera.zoom;
        const scaleY = HUD.SCROLL_SPEED / this.camera.zoom;

        this.camera.position.x -= deltaX * scaleX;
        this.camera.position.y += deltaY * scaleY;

        this.initialMousePosition.set(event.clientX, event.clientY);
        this.updateMeshPositions();
    }

    private updateMouseCoordinates(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    private onMouseClick(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        if (this.selectedActor)
            this.selectedActor = this.selectedActor.deselect();
        this.mouseClickEvents.forEach((executeCallback, condition) => {
            if (condition()) executeCallback()
        });
    }

    private onMouseMove(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.checkHoverState();
    }

    private checkHoverState(): void {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.isHoveringMesh.forEach((wasHovering, mesh) => {
            const intersected = this.raycaster.intersectObject(mesh).length > 0;

            if (intersected && !wasHovering)
                this.onHoverEnter(mesh);
            else if (!intersected && wasHovering)
                this.onHoverLeave(mesh);
        });
    }

    private onHoverEnter(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, true);
        HUD.changeMeshAppearance(mesh, HUD.HOVER_COLOR, this.getMeshScale() * HUD.HOVER_SCALE_FACTOR);
    }

    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        HUD.changeMeshAppearance(mesh, HUD.BASE_COLOR, this.getMeshScale());
    }

    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}