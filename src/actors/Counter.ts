import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "./ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {InstructionBuffer} from "./InstructionBuffer";
import {DrawUtils} from "../DrawUtils";

export class Counter extends ComputerChipMacro {
    private count = 0;
    width: number = 0.2
    height: number = InstructionBuffer.BUFFER_HEIGHT;

    private readonly highlightGeometry: PlaneGeometry;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0) {
        super(parent, xOffset, yOffset);
        this.highlightGeometry = new PlaneGeometry(this.width, this.height);
    }

    public get(): number {
        return this.count;
    }

    public update(): void {
        DrawUtils.updateText(this.liveMeshes[0], DrawUtils.toHex(this.count++), true);
    }

    public initializeGraphics(): void {
        const bodyMesh = new Mesh(this.highlightGeometry, Counter.COMPONENT_COLOR);
        bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.addStaticMesh(bodyMesh);
        this.liveMeshes.push(DrawUtils.buildTextMesh(DrawUtils.toHex(this.count), this.position.x, this.position.y,
            ComputerChipMacro.TEXT_SIZE, ComputerChipMacro.TEXT_COLOR, false));
        this.liveMeshes[0].geometry.center();
        this.scene.add(this.liveMeshes[0]);
    }
}