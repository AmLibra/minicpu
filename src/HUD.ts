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
    private static readonly MENU_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});
    private static readonly TEXT_SIZE: number = 0.05;

    private static MENU_LAYER: number = 0.1;

    private static readonly ZOOM_FACTOR: number = 0.0001;
    private static readonly MAX_ZOOM: number = 0.5;
    private static readonly MIN_ZOOM: number = 1;
    private static readonly MAX_CAMERA_POSITION_X = 1;
    private static readonly MAX_CAMERA_POSITION_Y = 1;
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

    private menuMesh: Mesh; // Menu mesh
    private menuTitleMesh: Mesh; // Menu title mesh

    constructor(app: App) {
        this.scene = app.scene;
        this.cpu = app.cpu;
        this.camera = app.camera;
        this.app = app;
        this.addMouseClickEvents();

        document.addEventListener('click', this.onMouseClick.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseDrag);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('wheel', this.onMouseWheel);
        window.addEventListener('resize', () => this.onWindowResize());
    }

    public drawHUD(): HUD {
        this.drawStats();
        this.drawMenu();
        this.scene.add(this.totalExecutedInstructions, this.IPCMesh, this.IPSMesh, this.menuMesh, this.menuTitleMesh);
        this.drawPauseButton();

        this.addMouseHoverEvents();
        this.updateMeshScale();
        this.updateMeshPositions();
        return this;
    }

    update(): void {
        DrawUtils.updateText(this.IPCMesh, "IPC: " + this.cpu.getIPC());
        DrawUtils.updateText(this.totalExecutedInstructions, "Retired instructions: " + this.cpu.getAccRetiredInstructionsCount());
        DrawUtils.updateText(this.IPSMesh, "IPS: " + this.cpu.getIPS());
    }

    private showMenu(): void {
        DrawUtils.updateText(this.menuTitleMesh, this.selectedActor ? this.selectedActor.displayName() : "undefined");
        this.menuTitleMesh.geometry.center();
        this.menuMesh.visible = true;

        this.menuTitleMesh.visible = true;
    }

    private hideMenu(): void {
        this.menuMesh.visible = false;
        this.menuTitleMesh.visible = false;
    }

    private updateMeshPositions(): void {
        const startY = this.topLeft().y;
        const middleX = this.topLeft().x;
        const padding = 0.1 / this.camera.zoom;
        this.IPCMesh.position.set(middleX, startY, HUD.MENU_LAYER);
        this.IPSMesh.position.set(middleX, startY + padding, HUD.MENU_LAYER);
        this.totalExecutedInstructions.position.set(middleX, startY + 2 * padding, HUD.MENU_LAYER);

        this.menuMesh.position.set(this.bottomCenter().x, this.bottomCenter().y, HUD.MENU_LAYER);
        const titleMeshPositionY = this.menuMesh.position.y + 0.4 / this.camera.zoom;
        this.menuTitleMesh.position.set(this.bottomCenter().x, titleMeshPositionY, HUD.MENU_LAYER);

        const startX = this.topRight().x;
        this.pauseButtonMesh.position.set(startX, this.topRight().y, HUD.MENU_LAYER);
        this.playButtonMesh.position.set(startX, this.topRight().y, HUD.MENU_LAYER);
    }

    private updateMeshScale(): void {
        const scale = this.getMeshScale();
        this.IPCMesh.scale.set(scale, scale, scale);
        this.totalExecutedInstructions.scale.set(scale, scale, scale);
        this.IPSMesh.scale.set(scale, scale, scale);
        this.pauseButtonMesh.scale.set(scale, scale, scale);
        this.playButtonMesh.scale.set(scale, scale, scale);
        this.menuMesh.scale.set(scale, scale, scale);
        this.menuTitleMesh.scale.set(scale, scale, scale);
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

    private bottomCenter(): Vector2 {
        const startX = this.camera.position.x;
        const startY = this.camera.position.y - (this.camera.top - 0.1) / this.camera.zoom;
        return new Vector2(startX, startY);
    }

    private drawStats(): void {
        const textY = this.topLeft().y;
        const textX = this.topLeft().x;
        const padding = 0.2
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), textX, textY,
            HUD.TEXT_SIZE, HUD.BASE_COLOR)
        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpu.getIPS(), textX, textY + padding,
            HUD.TEXT_SIZE, HUD.BASE_COLOR)
        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Retired instructions: " + this.cpu.getAccRetiredInstructionsCount(),
                textX, textY + 2 * padding, HUD.TEXT_SIZE, HUD.BASE_COLOR)
    }

    private drawMenu(): void {
        this.menuMesh = DrawUtils.buildQuadrilateralMesh(this.camera.right * 2, this.camera.top, HUD.MENU_COLOR, this.bottomCenter());
        this.menuMesh.position.set(this.bottomCenter().x, this.bottomCenter().y, HUD.MENU_LAYER);
        this.menuMesh.visible = false;

        this.menuTitleMesh = DrawUtils.buildTextMesh("undefined", this.bottomCenter().x, this.bottomCenter().y,
            HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);

        const titleMeshPositionY = this.menuMesh.position.y + 0.2 / this.camera.zoom;
        this.menuTitleMesh.position.set(this.bottomCenter().x, titleMeshPositionY, HUD.MENU_LAYER);
        this.menuTitleMesh.visible = false;
        this.menuTitleMesh.geometry.center();
    }

    private drawPauseButton(): void {
        const startY = this.topRight().y;
        const startX = this.topRight().x;
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(0.1, HUD.BASE_COLOR).translateX(startX).translateY(startY).rotateZ(-Math.PI / 2);

        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, HUD.BASE_COLOR, {x: startX,y: startY}).translateX(startX).translateY(startY);
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
                () => {
                    if (this.selectedActor)
                        this.selectedActor = this.selectedActor.deselect();
                    this.selectedActor = actor.select()
                    this.showMenu();
                }
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
        if (!this.mouseDown) return;
        const deltaX = (event.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (event.clientY - this.initialMousePosition.y) / window.innerHeight;
        const aspectRatio = window.innerWidth / window.innerHeight;

        const scaleX = aspectRatio * HUD.SCROLL_SPEED / this.camera.zoom;
        const scaleY = HUD.SCROLL_SPEED / this.camera.zoom;

        this.camera.position.x -= deltaX * scaleX;
        this.camera.position.x = Math.max(-HUD.MAX_CAMERA_POSITION_X, this.camera.position.x);
        this.camera.position.x = Math.min(HUD.MAX_CAMERA_POSITION_X, this.camera.position.x);
        this.camera.position.y += deltaY * scaleY;
        this.camera.position.y = Math.max(-HUD.MAX_CAMERA_POSITION_Y, this.camera.position.y);
        this.camera.position.y = Math.min(HUD.MAX_CAMERA_POSITION_Y, this.camera.position.y);

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

    private onWindowResize(): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        this.camera.left = -aspectRatio;
        this.camera.right = aspectRatio;
        this.camera.updateProjectionMatrix();
        this.app.renderer.setSize(window.innerWidth, window.innerHeight);
        this.updateMeshPositions();
        this.updateMeshScale();
    }

    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}