import {Mesh, MeshBasicMaterial, Scene} from "three";
import {ComputerChip} from "../ComputerChip";
import {DrawUtils} from "../../DrawUtils";

export abstract class ComputerChipMacro {
    protected readonly scene: Scene;
    protected readonly parent: ComputerChip;
    protected readonly position: { x: number; y: number };

    height: number;
    width: number;

    protected staticMeshes: Mesh[] = [];
    protected liveMeshes: Mesh[] = [];
    protected highlightMeshes: Mesh[] = [];

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
    protected static readonly BRANCH_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_BLUE")});

    protected static readonly PIN_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});
    protected static readonly TEXT_SIZE: number = 0.05;

    protected constructor(parent: ComputerChip, xOffset: number, yOffset: number) {
        this.parent = parent;
        this.scene = parent.scene;
        this.position = {x: parent.position.x + xOffset, y: parent.position.y + yOffset};
    }

    public abstract update(): void;

    public abstract initializeGraphics(): void;

    public dispose(): void{
        this.clearHighlights();
        this.scene.remove(...this.staticMeshes, ...this.liveMeshes, ...this.highlightMeshes);
        this.staticMeshes.forEach(mesh => mesh.geometry.dispose());
        this.liveMeshes.forEach(mesh => mesh.geometry.dispose());
        this.highlightMeshes.forEach(mesh => mesh.geometry.dispose());
    }

    protected addStaticMesh(mesh: Mesh): void {
        this.staticMeshes.push(mesh);
        this.scene.add(mesh);
    }

    protected clearHighlights(): void {
        this.highlightMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.highlightMeshes = [];
    }
}