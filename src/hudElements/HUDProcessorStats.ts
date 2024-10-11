import {DrawUtils} from "../DrawUtils";
import {Mesh, Scene, Vector2} from "three";
import {HUD} from "../HUD";
import {SISDProcessor} from "../actors/SISDProcessor";

/**
 * The HUD element for displaying processor statistics.
 */
export class HUDProcessorStats {
    private scene: Scene;
    private readonly position: Vector2;

    private readonly IPCMesh: Mesh;
    private IPCMeshBackground: Mesh;
    private ipcStringLength: number;

    private readonly IPSMesh: Mesh;
    private IPSMeshBackground: Mesh;
    private ipsStringLength: number;

    private readonly totalExecutedInstructions: Mesh;
    private totalExecutedInstructionsBackground: Mesh;
    private totalExecutedInstructionsStringLength: number;

    /**
     * Creates a new HUD element for displaying processor statistics.
     *
     * @param scene The scene to add the HUD element to.
     * @param position The position of the HUD element.
     * @param cpus The processors to display statistics for.
     */
    constructor(scene: Scene, position: Vector2, private readonly cpus: SISDProcessor[]) {
        const padding = 0.1

        let ipc = this.ipcString();
        this.ipcStringLength = ipc.length;
        this.IPCMesh = DrawUtils.buildTextMesh("IPC: " + ipc, position.x, position.y, HUD.TEXT_SIZE, HUD.BASE_COLOR, false)
        this.IPCMeshBackground = DrawUtils.addBackgroundMesh(this.IPCMesh, position, HUD.MENU_COLOR)

        let ips = this.ipsString();
        this.ipsStringLength = ips.length;
        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + ips, position.x, position.y + padding, HUD.TEXT_SIZE, HUD.BASE_COLOR, false)
        this.IPSMeshBackground = DrawUtils.addBackgroundMesh(this.IPSMesh, new Vector2(position.x, position.y + padding), HUD.MENU_COLOR)

        let retiredInstructions = this.retiredInstructionsString();
        this.totalExecutedInstructionsStringLength = retiredInstructions.length;
        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Retired instructions: " + retiredInstructions, position.x, position.y + 2 * padding, HUD.TEXT_SIZE, HUD.BASE_COLOR, false);
        this.totalExecutedInstructionsBackground =
            DrawUtils.addBackgroundMesh(this.totalExecutedInstructions, new Vector2(position.x, position.y + 2 * padding), HUD.MENU_COLOR);

        scene.add(this.IPCMesh, this.IPSMesh, this.totalExecutedInstructions, this.IPCMeshBackground,
            this.IPSMeshBackground, this.totalExecutedInstructionsBackground);
        this.scene = scene;
        this.position = position;
    }

    /**
     * Updates the HUD elements.
     */
    public update(): void {
        let ipc = this.cpus.reduce((acc, cpu) => acc + cpu.getIPC(), 0).toFixed(2);
        DrawUtils.updateText(this.IPCMesh, "IPC: " + ipc, false);
        if (ipc.length > this.ipcStringLength) {
            this.scene.remove(this.IPCMeshBackground);
            this.IPCMeshBackground = DrawUtils.addBackgroundMesh(this.IPCMesh, this.position, HUD.MENU_COLOR);
            this.scene.add(this.IPCMeshBackground);
            this.ipcStringLength = ipc.length;
        }

        let retiredInstructions = this.cpus.reduce((acc, cpu) => acc + cpu.getAccRetiredInstructionsCount(), 0);
        DrawUtils.updateText(this.totalExecutedInstructions, "Retired instructions: " + retiredInstructions, false);
        if (retiredInstructions.toString().length > this.totalExecutedInstructionsStringLength) {
            this.scene.remove(this.totalExecutedInstructionsBackground);
            this.totalExecutedInstructionsBackground =
                DrawUtils.addBackgroundMesh(this.totalExecutedInstructions, new Vector2(this.position.x, this.position.y + 0.2), HUD.MENU_COLOR);
            this.scene.add(this.totalExecutedInstructionsBackground);
            this.totalExecutedInstructionsStringLength = retiredInstructions.toString().length;
        }

        let ips = this.cpus.reduce((acc, cpu) => acc + cpu.getIPS(), 0).toFixed(2);
        DrawUtils.updateText(this.IPSMesh, "IPS: " + ips, false);
        if (ips.length > this.ipsStringLength) {
            this.scene.remove(this.IPSMeshBackground);
            this.IPSMeshBackground =
                DrawUtils.addBackgroundMesh(this.IPSMesh, new Vector2(this.position.x, this.position.y + 0.1), HUD.MENU_COLOR);
            this.scene.add(this.IPSMeshBackground);
            this.ipsStringLength = ips.length;
        }
    }

    /**
     * Clears the HUD elements.
     */
    public clear(): void {
        this.scene.remove(this.IPCMesh, this.IPSMesh, this.totalExecutedInstructions,
            this.IPCMeshBackground, this.IPSMeshBackground, this.totalExecutedInstructions);
        DrawUtils.disposeMeshes(this.IPCMesh, this.IPSMesh, this.totalExecutedInstructions,
            this.IPCMeshBackground, this.IPSMeshBackground, this.totalExecutedInstructionsBackground);
    }

    private ipcString(): string {
        return this.cpus.reduce((acc, cpu) => acc + cpu.getIPC(), 0).toFixed(2);
    }

    private ipsString(): string {
        return this.cpus.reduce((acc, cpu) => acc + cpu.getIPS(), 0).toFixed(2);
    }

    private retiredInstructionsString(): string {
        return this.cpus.reduce((acc, cpu) => acc + cpu.getAccRetiredInstructionsCount(), 0).toString();
    }
}