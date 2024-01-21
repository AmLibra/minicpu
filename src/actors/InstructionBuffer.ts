import {ComputerChipMacro} from "./ComputerChipMacro";
import {Mesh, PlaneGeometry} from "three";
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
    protected readonly NO_OP_MESH: Mesh;

    private readonly spacing: number;
    private bufferMeshVerticalOffsets: number[] = [];
    private bufferMeshHorizontalOffsets: number[] = [];

    private readonly instructionMemory: Queue<Instruction>;
    private readonly size: number;
    private readonly reversed: boolean;
    private readonly horizontal: boolean;

    private readyToBeRead: boolean = false;
    private readTimeout: number = 0;
    private readonly noDelay: boolean;

    constructor(parent: ComputerChip, size: number, xOffset: number = 0, yOffset: number = 0, noDelay: boolean = true, reversed: boolean = false,
                horizontal: boolean = false, bufferWidth: number = InstructionBuffer.BUFFER_BASE_WIDTH, spacing: number = InstructionBuffer.INNER_SPACING) {
        super(parent, xOffset, yOffset);
        this.instructionMemory = new Queue<Instruction>(size);
        this.size = size;
        this.noDelay = noDelay;
        this.reversed = reversed;
        this.horizontal = horizontal;
        const spaceNeeded = InstructionBuffer.BUFFER_HEIGHT * size + InstructionBuffer.INNER_SPACING * (size - 1);
        this.width = this.horizontal ? spaceNeeded : bufferWidth;
        this.height = this.horizontal ? bufferWidth : spaceNeeded;
        this.spacing = spacing;
        this.NO_OP_MESH = DrawUtils.buildTextMesh("NOP", 0, 0, ComputerChipMacro.TEXT_SIZE,
            ComputerChipMacro.BODY_COLOR, true, this.horizontal ? Math.PI / 2 : 0);
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

    public read(readCount: number): Queue<Instruction> {
        if (!this.noDelay && !this.readyToBeRead)
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);
        const instructionsToRead = new Queue<Instruction>(readCount)
        this.instructionMemory.moveTo(instructionsToRead, readCount)
        this.shiftDown(readCount);
        this.readyToBeRead = false;
        return instructionsToRead;
    }

    public write(instructions: Queue<Instruction>, writeCount = instructions.size()): void {
        if (instructions.size() > this.size)
            throw new Error("Cannot write more instructions than the size of the buffer");

        instructions.moveTo(this.instructionMemory, writeCount);
        for (let i = 0; i < this.instructionMemory.size(); ++i) {
            this.scene.remove(this.meshes[i]);
            this.meshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.meshes[i]);
        }
    }

    update(): void {
        if (this.readTimeout > 0) {
            this.readTimeout--;
            this.readyToBeRead = this.readTimeout <= 0;
        }
    }

    initializeGraphics(): void {
        this.scene.add(this.buildBufferMeshes());
        for (let i = 0; i < this.size; ++i) {
            this.meshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.meshes[i]);
        }
    }

    private buildBufferMeshes(): Mesh {
        const totalSpacing = this.spacing * (this.size - 1);
        const rectangleDimension = ((this.horizontal ? this.width : this.height) - totalSpacing) / this.size;
        const startOffset = this.horizontal
            ? this.position.x + (this.reversed ? -1 : 1) * ((rectangleDimension / 2) - this.width / 2)
            : this.position.y + (this.reversed ? -1 : 1) * (rectangleDimension / 2 - this.height / 2);

        let geometries = [];
        for (let i = 0; i < this.size; ++i) {
            const offset = this.reversed
                ? startOffset - i * (rectangleDimension + this.spacing)
                : startOffset + i * (rectangleDimension + this.spacing);

            const geometry = new PlaneGeometry(this.horizontal ? rectangleDimension : this.width, this.horizontal ? this.height : rectangleDimension);
            this.horizontal ? geometry.translate(offset, this.position.y, 0)
                : geometry.translate(this.position.x, offset, 0);

            this.horizontal
                ? this.bufferMeshHorizontalOffsets.push(offset)
                : this.bufferMeshVerticalOffsets.push(offset);

            geometries.push(geometry);
        }

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, true);
        if (!mergedGeometry)
            throw new Error("Failed to merge geometries");
        return new Mesh(mergedGeometry, ComputerChipMacro.COMPONENT_COLOR);
    }


    private buildBufferTextMesh(index: number): Mesh {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");

        const xOffset = this.horizontal ? this.bufferMeshHorizontalOffsets[index] : this.position.x;
        const yOffset = this.horizontal ? this.position.y : this.bufferMeshVerticalOffsets[index];

        if (this.instructionMemory.get(index)) {
            const color = this.instructionMemory.get(index).isMemoryOperation() ?
                ComputerChipMacro.MEMORY_COLOR : ComputerChipMacro.ALU_COLOR;
            return DrawUtils.buildTextMesh(this.instructionMemory.get(index).toString(), xOffset, yOffset,
                ComputerChipMacro.TEXT_SIZE, color, true, this.horizontal ? Math.PI / 2 : 0
            );
        } else { // using instancing to save memory
            return this.NO_OP_MESH.clone().translateX(xOffset).translateY(yOffset);
        }
    }

    private shiftDown(nPositions: number): void {
        if (nPositions <= 0)
            throw new Error("Cannot shift down by a negative number of positions");
        if (nPositions > this.size)
            throw new Error("Cannot shift down by more than the size of the buffer");

        this.meshes.splice(0, nPositions).forEach(mesh => this.scene.remove(mesh));

        if (this.horizontal) {
            this.meshes.forEach((mesh, index) =>
                mesh.translateX(-this.bufferMeshHorizontalOffsets[index + nPositions] + this.bufferMeshHorizontalOffsets[index])
            );
        } else {
            this.meshes.forEach((mesh, index) =>
                mesh.translateY(-this.bufferMeshVerticalOffsets[index + nPositions] + this.bufferMeshVerticalOffsets[index])
            );
        }

        // Fill the empty spaces with NO_OP_MESH
        for (let i = this.size; i > this.size - nPositions; --i) {
            const offsetIndex = i - 1;
            this.meshes[offsetIndex] = this.NO_OP_MESH.clone()
                .translateX(this.horizontal ? this.bufferMeshHorizontalOffsets[offsetIndex] : this.position.x)
                .translateY(this.horizontal ? this.position.y : this.bufferMeshVerticalOffsets[offsetIndex]);
            this.scene.add(this.meshes[offsetIndex]);
        }
    }
}