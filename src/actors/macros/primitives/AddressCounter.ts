import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../../ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {InstructionBuffer} from "./InstructionBuffer";
import {DrawUtils} from "../../../DrawUtils";

/**
 * A counter component for use within a computer chip.
 */
export class AddressCounter extends ComputerChipMacro {
    private static readonly WIDTH = 0.3;
    private count = 0;
    height: number = InstructionBuffer.BUFFER_HEIGHT;

    private readonly highlightGeometry: PlaneGeometry;
    private highlighted: boolean = false;

    /**
     * Constructs a new Counter instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset from the parent's position to place this component.
     * @param yOffset The y-offset from the parent's position to place this component.
     * @param width The width of the counter component.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, width: number = AddressCounter.WIDTH) {
        super(parent, xOffset, yOffset);
        this.width = width;
        this.highlightGeometry = new PlaneGeometry(this.width, this.height);
    }

    public static dimensions(): { width: number, height: number } {
        return {width: this.WIDTH, height: InstructionBuffer.BUFFER_HEIGHT};
    }

    /**
     * Gets the current value of the counter.
     */
    public get(): number {
        return this.count;
    }

    /**
     * Sets the value of the counter.
     *
     * @param n The new value of the counter.
     */
    public set(n: number): void {
        this.count = n;
        DrawUtils.updateText(this.liveMeshes[0], DrawUtils.toHex(this.count), true);
        this.highlighted = true;
        this.highlight();
    }

    update(highlightsOnly?: boolean): void {
        if (this.highlighted)
            this.clearHighlights()
        if (highlightsOnly)
            return;
        DrawUtils.updateText(this.liveMeshes[0], DrawUtils.toHex(this.count++), true);
    }

    initializeGraphics(): void {
        const bodyMesh = new Mesh(this.highlightGeometry, AddressCounter.COMPONENT_MATERIAL);
        bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.addStaticMesh(bodyMesh);
        this.liveMeshes.push(DrawUtils.buildTextMesh(DrawUtils.toHex(this.count), this.position.x, this.position.y,
            ComputerChipMacro.TEXT_SIZE, ComputerChipMacro.TEXT_MATERIAL, false));
        this.liveMeshes[0].geometry.center();
        this.scene.add(this.liveMeshes[0]);
    }

    dispose(): void {
        super.dispose();
        this.highlightGeometry.dispose();
    }

    clearHighlights() {
        super.clearHighlights();
        this.highlighted = false;
        if (this.liveMeshes[0])
            this.liveMeshes[0].material = ComputerChipMacro.TEXT_MATERIAL;
    }

    /**
     * Highlights the counter component.
     *
     * @private
     */
    private highlight() {
        const highlightMesh = new Mesh(this.highlightGeometry, ComputerChipMacro.BRANCH_MATERIAL);
        highlightMesh.position.set(this.position.x, this.position.y, 0);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.liveMeshes[0].material = ComputerChipMacro.COMPONENT_MATERIAL;
        this.highlighted = true;
    }
}