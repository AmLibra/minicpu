import {Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {SISDCore} from "./actors/SISDCore";
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
    private static readonly MAX_CAMERA_POSITION_X = 2;
    private static readonly MAX_CAMERA_POSITION_Y = 2;
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
    private cpu: SISDCore;
    private readonly camera: OrthographicCamera;
    private app: App;
    private selectedActor: ComputerChip;

    private isHoveringMesh: Map<Mesh, boolean> = new Map<Mesh, boolean>();
    private gameMouseClickEvents: Map<Function, Function> = new Map<Function, Function>();
    private hudMouseClickEvents: Map<Function, Function> = new Map<Function, Function>();

    private menuMesh: Mesh; // Menu mesh
    private menuTitleMesh: Mesh; // Menu title mesh
    private menuCloseMesh: Mesh; // Menu close mesh

    private readonly hudScene: Scene;
    private readonly hudCamera: OrthographicCamera;

    constructor(app: App) {
        this.scene = app.scene;
        this.cpu = app.cpu;
        this.camera = app.camera;
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
    }

    public getHUDScene(): Scene {
        return this.hudScene;
    }

    public getHUDCamera(): OrthographicCamera {
        return this.hudCamera;
    }

    public drawHUD(): HUD {
        this.drawStats();
        this.drawMenu();
        this.hudScene.add(this.totalExecutedInstructions, this.IPCMesh, this.IPSMesh, this.menuMesh, this.menuTitleMesh,
            this.menuCloseMesh);
        this.drawPauseButton();

        this.addMouseHoverEvents();
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
        this.menuCloseMesh.visible = true;
    }

    private hideMenu(): void {
        this.menuMesh.visible = false;
        this.menuTitleMesh.visible = false;
        this.menuCloseMesh.visible = false;
    }

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

    private drawMenu(): void {
        this.menuMesh = DrawUtils.buildQuadrilateralMesh(this.hudCamera.right * 2, this.hudCamera.top * 0.8, HUD.MENU_COLOR,
            {x: this.hudCamera.position.x, y: this.hudCamera.position.y - this.hudCamera.top * 0.8});
        this.menuMesh.visible = false;

        this.menuTitleMesh = DrawUtils.buildTextMesh("undefined",0,this.hudCamera.bottom + 0.5,
            HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);
        this.menuTitleMesh.geometry.center();
        this.menuTitleMesh.visible = false;

        let closeMesh = this.menuCloseMesh;
        DrawUtils.buildImageMesh("res/close.png", 0.2, 0.2,
            (mesh: Mesh) => this.buildCloseMesh(mesh));
        this.menuCloseMesh = closeMesh;
    }

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

    private drawPauseButton(): void {
        const startY = this.hudCamera.top - 0.1;
        const startX = this.hudCamera.right - 0.1;
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(0.1, HUD.BASE_COLOR)
            .translateX(startX).translateY(startY).rotateZ(-Math.PI / 2);

        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, HUD.BASE_COLOR, {
            x: startX,
            y: startY
        })
        this.playButtonMesh.visible = false;

        this.hudScene.add(this.pauseButtonMesh, this.playButtonMesh);
    }

    private addMouseClickEvents(): void {
        this.hudMouseClickEvents.set(
            () => this.raycaster.intersectObject(this.pauseButtonMesh).concat(this.raycaster.intersectObject(this.playButtonMesh)).length > 0,
            () => this.togglePauseState()
        );

        this.app.gameActors.forEach(actor => {
            this.gameMouseClickEvents.set(
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
    }

    private updateMouseCoordinates(event: MouseEvent): void {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    private onMouseClick(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.gameMouseClickEvents.forEach((executeCallback, condition) => {
            if (condition()) executeCallback()
        });
        this.raycaster.setFromCamera(this.mouse, this.hudCamera);
         this.hudMouseClickEvents.forEach((executeCallback, condition) => {
            if (condition()) executeCallback()
        });
    }

    private onMouseMove(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.checkHoverState();
    }

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

    private onHoverEnter(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, true);
        HUD.changeMeshAppearance(mesh, HUD.HOVER_COLOR, HUD.HOVER_SCALE_FACTOR);
    }

    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        HUD.changeMeshAppearance(mesh, HUD.BASE_COLOR, 1);
    }

    private onWindowResize(): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        this.camera.left = -aspectRatio;
        this.camera.right = aspectRatio;
        this.camera.updateProjectionMatrix();
        this.app.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}