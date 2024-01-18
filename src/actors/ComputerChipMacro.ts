import {MeshBasicMaterial, Scene} from "three";
import {ComputerChip} from "./ComputerChip";
import {DrawUtils} from "../DrawUtils";

export abstract class ComputerChipMacro {
    protected readonly scene: Scene;
    protected readonly parent: ComputerChip;
    protected readonly position: { x: number; y: number };

    protected height: number;
    protected width: number;

    protected static readonly BODY_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly COMPONENT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARKER")});
    protected static readonly TEXT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    protected static readonly HUD_TEXT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    protected static readonly MEMORY_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_GREEN")});
    protected static readonly ALU_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_RED")});
    protected static readonly PIN_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});
    protected static readonly TEXT_SIZE: number = 0.05;

    protected constructor(parent: ComputerChip, scene: Scene, position: { x: number; y: number }) {
        this.parent = parent;
        this.scene = scene;
        this.position = position;
    }

    public abstract update(): void;

    public abstract initializeGraphics(): void;
}