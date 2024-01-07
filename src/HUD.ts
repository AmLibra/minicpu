import {Camera, Mesh, MeshBasicMaterial, Raycaster, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {CPU} from "./actors/CPU";
import {App} from "./app";

export class HUD {
    private raycaster = new Raycaster(); // mouse raycaster
    private mouse = new Vector2(); // mouse coordinates

    private static readonly COLORS: Map<string, MeshBasicMaterial> = new Map([
        ["BASE", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})],
        ["HOVER", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")})],
    ]);

    private static readonly TEXT_SIZE: number = 0.05;

    private pauseButtonMesh: Mesh; // the pause button
    private playButtonMesh: Mesh; // the play button
    private isHoveringMesh: Map<Mesh, boolean> = new Map<Mesh, boolean>();
    private mouseClickEvents: Map<Function, Function> = new Map<Function, Function>();

    private IPCMesh: Mesh;
    private IPSMesh: Mesh;
    private totalExecutedInstructions: Mesh;

    private scene: Scene;
    private cpu: CPU;
    private readonly camera: Camera;
    private app: App;

    constructor(app: App) {
        this.scene = app.scene;
        this.cpu = app.cpu;
        this.camera = app.camera;
        this.app = app;
        this.addMouseClickEvents();
        app.document.addEventListener('click', this.onMouseClick.bind(this), false);
        app.document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    }

    public drawHUD(): HUD {
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + this.cpu.getIPC(), 0, 0.9,
            HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))

        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Total executed instructions: " + this.cpu.getAccumulatedInstructionCount(),
                0, 0.8, HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))

        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpu.getIPS(), 0, 0.7,
            HUD.TEXT_SIZE, HUD.COLORS.get("BASE"))

        this.scene.add(this.totalExecutedInstructions, this.IPCMesh, this.IPSMesh);

        this.drawPauseButton();
        this.addMouseHoverEvents();
        return this;
    }

    update(): void {
        DrawUtils.updateMeshText(this.IPCMesh, "IPC: " + this.cpu.getIPC());
        DrawUtils.updateMeshText(this.totalExecutedInstructions,
            "Total executed instructions: " + this.cpu.getAccumulatedInstructionCount());

        DrawUtils.updateMeshText(this.IPSMesh, "IPS: " + this.cpu.getIPS());
    }

    private drawPauseButton(): void {
        this.pauseButtonMesh = DrawUtils.buildTriangleMesh(
            0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        ).translateX(1.5).translateY(1).rotateZ(-Math.PI / 2);

        this.playButtonMesh = DrawUtils.buildQuadrilateralMesh(
            0.1, 0.1, new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})
        ).translateX(1.5).translateY(1);
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
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("LIGHT"), 1.1);
    }

    private onHoverLeave(mesh: Mesh): void {
        this.isHoveringMesh.set(mesh, false);
        DrawUtils.changeMeshAppearance(mesh, DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT"), 1);
    }
}