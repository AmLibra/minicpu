import {ComputerChipMacro} from "./ComputerChipMacro";
import {Mesh, PlaneGeometry, Scene} from "three";
import {Queue} from "../components/Queue";
import {Instruction} from "../components/Instruction";
import {ComputerChip} from "./ComputerChip";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class InstructionBuffer extends ComputerChipMacro {
    protected static readonly BUFFER_HEIGHT: number = 0.15;
    protected static readonly BUFFER_BASE_WIDTH: number = 0.7;
    protected static readonly INNER_SPACING = 0.01;
    protected readonly NO_OP_MESH: Mesh =
        DrawUtils.buildTextMesh("NOP", 0, 0, ComputerChipMacro.TEXT_SIZE, ComputerChipMacro.BODY_COLOR);

    private readonly spacing: number;
    private bufferMeshVerticalOffsets: number[] = [];

    private readonly instructionMemory: Queue<Instruction>;
    private readonly size: number;
    private readonly reversed: boolean;

    private readyToBeRead: boolean = false;
    private readTimeout: number = 0;
    private readonly noDelay: boolean;

    constructor(parent: ComputerChip, scene: Scene, position: {
                    x: number;
                    y: number
                }, size: number, noDelay: boolean, reversed: boolean = false,
                bufferWidth: number = InstructionBuffer.BUFFER_BASE_WIDTH, spacing: number = InstructionBuffer.INNER_SPACING) {
        super(parent, scene, position);
        this.instructionMemory = new Queue<Instruction>(size);
        this.size = size;
        this.noDelay = noDelay;
        this.reversed = reversed;
        this.width = bufferWidth;
        this.spacing = spacing;
        this.height = InstructionBuffer.BUFFER_HEIGHT * size + InstructionBuffer.INNER_SPACING * (size - 1);
        this.instructionMemory.enqueue(new Instruction("ADD", "R3", "R2", "R1"));
        this.instructionMemory.enqueue(new Instruction("STORE", "R1", undefined, undefined, 0));
        this.instructionMemory.enqueue(new Instruction("ADD", "R1", "R2", "R3"));
    }

    public getSize(): number {
        return this.size;
    }

    public isReadyToBeRead(): boolean {
        if (this.noDelay)
            throw new Error("No delay instruction buffers are always ready to be read");
        return this.readyToBeRead;
    }

    public askForInstructions(cpu: CPU): void {
        if (this.noDelay)
            throw new Error("There is no need to ask for instructions when there is no delay");
        if (this.readTimeout > 0)
            return;
        this.readyToBeRead = false;
        this.readTimeout = cpu.getClockFrequency() / this.parent.getClockFrequency();
    }

    public read(n: number): Queue<Instruction> {
        if (!this.noDelay && !this.readyToBeRead)
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);
        const instructionsToRead = new Queue<Instruction>(n)
        this.instructionMemory.moveTo(instructionsToRead, n)


        this.readyToBeRead = false;
        return instructionsToRead;
    }

    update(): void {
        // Does not need to be updated every frame
    }

    initializeGraphics(): void {
        this.scene.add(this.buildBufferMeshes());
        for (let i = 0; i < this.size; ++i)
            this.scene.add(this.buildBufferTextMesh(i));
    }

    private buildBufferMeshes(): Mesh {
        const totalSpacing = this.spacing * (this.size - 1);
        const rectangleHeight = (this.height - totalSpacing) / this.size;
        const startYOffset = this.position.y + (this.reversed ? -1 : 1) * rectangleHeight / 2;

        let geometries = [];
        for (let i = 0; i < this.size; ++i) {
            const yOffset = this.reversed ? startYOffset - i * (rectangleHeight + this.spacing) + this.height / 2 :
                startYOffset + i * (rectangleHeight + this.spacing) - this.height / 2;
            this.bufferMeshVerticalOffsets.push(yOffset);
            const geometry = new PlaneGeometry(this.width, rectangleHeight);
            geometry.translate(this.position.x, yOffset, 0);
            geometries.push(geometry);
        }

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, true);
        if (!mergedGeometry) {
            console.error("Failed to merge geometries");
            return;
        }

        return new Mesh(mergedGeometry, ComputerChipMacro.COMPONENT_COLOR);
    }

    private buildBufferTextMesh(index: number): Mesh {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");
        if (this.instructionMemory.get(index)) {
            const color = this.instructionMemory.get(index).isMemoryOperation() ?
                ComputerChipMacro.MEMORY_COLOR : ComputerChipMacro.ALU_COLOR;
            return DrawUtils.buildTextMesh(this.instructionMemory.get(index).toString(), this.position.x, this.bufferMeshVerticalOffsets[index],
                ComputerChipMacro.TEXT_SIZE, color);
        }
        else { // using instancing to save memory
            return this.NO_OP_MESH.clone().translateX(this.position.x).translateY(this.bufferMeshVerticalOffsets[index]);
        }
    }
}