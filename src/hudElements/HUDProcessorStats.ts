import {DrawUtils} from "../DrawUtils";
import {Mesh, Scene, Vector2} from "three";
import {HUD} from "../HUD";
import {SISDProcessor} from "../actors/SISDProcessor";

/**
 * The HUD element for displaying processor statistics.
 */
export class HUDProcessorStats {
    private readonly IPCMesh: Mesh;
    private readonly IPSMesh: Mesh;
    private readonly totalExecutedInstructions: Mesh;

    /**
     * Creates a new HUD element for displaying processor statistics.
     *
     * @param scene The scene to add the HUD element to.
     * @param position The position of the HUD element.
     * @param cpus The processors to display statistics for.
     */
    constructor(scene: Scene, position: Vector2, private readonly cpus: SISDProcessor[]) {
        const padding = 0.1
        this.IPCMesh = DrawUtils.buildTextMesh(
            "IPC: " + this.cpus.reduce((acc, cpu) => acc + cpu.getIPC(), 0).toFixed(2),
            position.x, position.y, HUD.TEXT_SIZE, HUD.BASE_COLOR, false)

        this.IPSMesh = DrawUtils.buildTextMesh("IPS: " + this.cpus.reduce((acc, cpu) => acc + cpu.getIPS(), 0).toFixed(2),
            position.x, position.y + padding, HUD.TEXT_SIZE, HUD.BASE_COLOR, false)

        this.totalExecutedInstructions =
            DrawUtils.buildTextMesh("Retired instructions: " + this.cpus.reduce((acc, cpu) => acc + cpu.getAccRetiredInstructionsCount(), 0),
                position.x, position.y + 2 * padding, HUD.TEXT_SIZE, HUD.BASE_COLOR, false);
        scene.add(this.IPCMesh, this.IPSMesh, this.totalExecutedInstructions);
    }

    /**
     * Updates the HUD elements.
     */
    public update(): void {
        DrawUtils.updateText(this.IPCMesh,
            "IPC: " + this.cpus.reduce((acc, cpu) => acc + cpu.getIPC(), 0).toFixed(2), false);
        DrawUtils.updateText(this.totalExecutedInstructions,
            "Retired instructions: " + this.cpus.reduce((acc, cpu) => acc + cpu.getAccRetiredInstructionsCount(), 0),
            false);
        DrawUtils.updateText(this.IPSMesh, "IPS: " + this.cpus.reduce((acc, cpu) => acc + cpu.getIPS(), 0).toFixed(2),
            false);

    }
}