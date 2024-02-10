import {Mesh, MeshBasicMaterial, Scene} from "three";
import {ComputerChip} from "../../ComputerChip";
import {DrawUtils} from "../../../DrawUtils";
import {Instruction} from "../../../components/Instruction";

/**
 * An abstract class representing a macro component of a computer chip within a simulation.
 * This class provides a common structure and functionality for various macro components
 * like ALUs, memory cells, and others within the chip simulation.
 */
export abstract class ComputerChipMacro {
    /** The Three.js scene to which the macro component belongs. */
    protected readonly scene: Scene;

    /** The parent ComputerChip object that this macro component is a part of. */
    protected readonly parent: ComputerChip;

    /** The position of the macro component within the scene. */
    protected readonly position: { x: number; y: number };

    /** The height and width of the macro component. */
    height: number;
    width: number;

    /** Static meshes that do not change during the simulation. */
    protected staticMeshes: Mesh[] = [];

    /** Meshes that may change or update during the simulation. */
    protected liveMeshes: Mesh[] = [];

    /** Meshes used to highlight parts of the component during certain operations. */
    protected highlightMeshes: Mesh[] = [];

    /** Materials used for different parts of the macro components. */
    protected static readonly BODY_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly COMPONENT_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARKER")});
    protected static readonly TEXT_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    protected static readonly MEMORY_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_GREEN")});
    protected static readonly ALU_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_RED")});
    protected static readonly BRANCH_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_BLUE")});

    /** The size of the text used within the macro component. */
    protected static readonly TEXT_SIZE: number = 0.05;

    /**
     * Constructs a new ComputerChipMacro instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset from the parent's position to place this component.
     * @param yOffset The y-offset from the parent's position to place this component.
     */
    protected constructor(parent: ComputerChip, xOffset: number, yOffset: number) {
        this.parent = parent;
        this.scene = parent.scene;
        this.position = {x: parent.position.x + xOffset, y: parent.position.y + yOffset};
    }

    /** Abstract method to update the state of the macro component. */
    public abstract update(): void;

    /** Abstract method to initialize the graphics of the macro component. */
    public abstract initializeGraphics(): void;

    /**
     * Disposes of the macro component by removing and disposing all associated meshes.
     */
    public dispose(): void {
        this.clearHighlights();
        [...this.staticMeshes, ...this.liveMeshes, ...this.highlightMeshes].forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
    }

    /**
     * Adds a static mesh to the macro component and the scene.
     *
     * @param mesh The mesh to add.
     */
    protected addStaticMesh(mesh: Mesh): void {
        this.staticMeshes.push(mesh);
        this.scene.add(mesh);
    }

    /**
     * Adds multiple static meshes to the macro component and the scene.
     *
     * @param meshes The meshes to add.
     */
    protected addStaticMeshes(...meshes: Mesh[]): void {
        this.staticMeshes.push(...meshes);
        this.scene.add(...meshes);
    }

    /**
     * Adds a live mesh to the macro component and the scene.
     *
     * @param mesh The mesh to add.
     */
    protected addLiveMesh(mesh: Mesh): void {
        this.liveMeshes.push(mesh);
        this.scene.add(mesh);
    }

    /**
     * Adds a highlight mesh to the macro component and the scene.
     *
     * @param mesh The mesh to add.
     */
    protected addHighlightMesh(mesh: Mesh): void {
        this.highlightMeshes.push(mesh);
        this.scene.add(mesh);
    }

    /**
     * Clears all highlight meshes from the macro component and the scene.
     */
    protected clearHighlights(): void {
        this.highlightMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.highlightMeshes = [];
    }

    protected instructionMaterial(instruction: Instruction): MeshBasicMaterial {
        if (instruction.isMemoryOperation())
            return ComputerChipMacro.MEMORY_MATERIAL;
        if (instruction.isArithmetic())
            return ComputerChipMacro.ALU_MATERIAL;
        return ComputerChipMacro.BRANCH_MATERIAL;
    }
}