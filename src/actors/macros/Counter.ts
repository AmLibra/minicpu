import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {InstructionBuffer} from "./InstructionBuffer";
import {DrawUtils} from "../../DrawUtils";

export class Counter extends ComputerChipMacro {
    private count = 0;
    height: number = InstructionBuffer.BUFFER_HEIGHT;

    private readonly highlightGeometry: PlaneGeometry;
    private highlighted: boolean = false;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, width: number = 0.3) {
        super(parent, xOffset, yOffset);
        this.width = width;
        this.highlightGeometry = new PlaneGeometry(this.width, this.height);
    }

    public get(): number {
        return this.count;
    }

    public set(n: number): void {
        this.count = n;
        DrawUtils.updateText(this.liveMeshes[0], DrawUtils.toHex(this.count), true);
        this.highlighted = true;
        this.highlight();
    }

    public update(): void {
        DrawUtils.updateText(this.liveMeshes[0], DrawUtils.toHex(this.count++), true);
        if (this.highlighted)
            this.clearHighlights()
    }

    public initializeGraphics(): void {
        const bodyMesh = new Mesh(this.highlightGeometry, Counter.COMPONENT_MATERIAL);
        bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.addStaticMesh(bodyMesh);
        this.liveMeshes.push(DrawUtils.buildTextMesh(DrawUtils.toHex(this.count), this.position.x, this.position.y,
            ComputerChipMacro.TEXT_SIZE, ComputerChipMacro.TEXT_MATERIAL, false));
        this.liveMeshes[0].geometry.center();
        this.scene.add(this.liveMeshes[0]);
    }

    public dispose(): void {
        super.dispose();
        this.highlightGeometry.dispose();
    }

    private highlight() {
        const highlightMesh = new Mesh(this.highlightGeometry, ComputerChipMacro.BRANCH_MATERIAL);
        highlightMesh.position.set(this.position.x, this.position.y, 0);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.liveMeshes[0].material = ComputerChipMacro.COMPONENT_MATERIAL;
        this.highlighted = true;
    }

    clearHighlights() {
        super.clearHighlights();
        this.highlighted = false;
        if (this.liveMeshes[0])
            this.liveMeshes[0].material = ComputerChipMacro.TEXT_MATERIAL;
    }
}