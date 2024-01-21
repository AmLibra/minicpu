import {ComputerChipMacro} from "./ComputerChipMacro";
import {Mesh, PlaneGeometry} from "three";
import {Queue} from "../components/Queue";
import {Instruction} from "../components/Instruction";
import {ComputerChip} from "./ComputerChip";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class InstructionBuffer extends ComputerChipMacro {
    private static readonly BUFFER_HEIGHT: number = 0.15;
    private static readonly BUFFER_BASE_WIDTH: number = 0.7;
    private static readonly INNER_SPACING = 0.01;
    private readonly noOpMesh: Mesh;
    private readonly bufferHighlightGeometry: PlaneGeometry;

    private readonly spacing: number;
    private readonly rectangleSize: number;
    private bufferMeshOffsets: number[] = [];

    public readonly size: number;

    private readonly storedInstructions: Queue<Instruction>;
    private readonly reversed: boolean;
    private readonly horizontal: boolean;

    private readyToBeRead: boolean = false;
    private readTimeout: number = 0;
    private readonly noDelay: boolean;

    constructor(parent: ComputerChip, size: number, xOffset: number = 0, yOffset: number = 0, noDelay: boolean = true, reversed: boolean = false,
                horizontal: boolean = false, bufferWidth: number = InstructionBuffer.BUFFER_BASE_WIDTH, spacing: number = InstructionBuffer.INNER_SPACING) {
        super(parent, xOffset, yOffset);
        this.storedInstructions = new Queue<Instruction>(size);
        this.size = size;
        this.noDelay = noDelay;
        this.reversed = reversed;
        this.horizontal = horizontal;
        const spaceNeeded = InstructionBuffer.BUFFER_HEIGHT * size + InstructionBuffer.INNER_SPACING * (size - 1);
        this.width = this.horizontal ? spaceNeeded : bufferWidth;
        this.height = this.horizontal ? bufferWidth : spaceNeeded;
        this.spacing = spacing;

        const totalSpacing = this.spacing * (this.size - 1);
        this.rectangleSize = ((this.horizontal ? this.width : this.height) - totalSpacing) / this.size;

        this.noOpMesh = DrawUtils.buildTextMesh("NOP", 0, 0, ComputerChipMacro.TEXT_SIZE,
            ComputerChipMacro.BODY_COLOR, true, this.horizontal ? Math.PI / 2 : 0);
        this.bufferHighlightGeometry = new PlaneGeometry(this.horizontal ? this.rectangleSize :
            this.width, this.horizontal ? this.height : this.rectangleSize);
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
        this.readTimeout = cpu.getClockFrequency() / this.parent.getClockFrequency();
    }

    public read(readCount: number): Queue<Instruction> {
        if (!this.noDelay && !this.isReadyToBeRead())
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);
        if (readCount > this.size)
            throw new Error("Cannot read more instructions than the size of the buffer");
        if (readCount > this.storedInstructions.size())
            return;

        const instructionsToRead = new Queue<Instruction>(readCount)
        this.storedInstructions.moveTo(instructionsToRead, readCount)
        this.shiftMeshesDown(readCount);
        if (this.storedInstructions.size() - readCount >= 1)
            this.highlightBuffer(readCount - 1);
        this.readyToBeRead = false;
        return instructionsToRead;
    }

    public write(instructions: Queue<Instruction>, writeCount = instructions.size()): void {
        if (writeCount > this.size)
            throw new Error("Cannot write more instructions than the size of the buffer");

        const oldSize = this.storedInstructions.size();
        instructions.moveTo(this.storedInstructions, writeCount);
        for (let i = oldSize; i < this.storedInstructions.size(); ++i) {
            this.scene.remove(this.meshes[i]);
            this.meshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.meshes[i]);
        }
    }

    update(): void {
        if (this.readTimeout > 0 && this.storedInstructions.size() > 0) {
            --this.readTimeout;
            if (this.readTimeout <= 0)
                this.readyToBeRead = true;
        }
    }

    initializeGraphics(): void {
        this.scene.add(this.buildBufferMeshes());
        for (let i = 0; i < this.size; ++i) {
            this.meshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.meshes[i]);
        }
    }

    private buildBufferTextMesh(index: number): Mesh {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");

        const xOffset = this.horizontal ? this.bufferMeshOffsets[index] : this.position.x;
        const yOffset = this.horizontal ? this.position.y : this.bufferMeshOffsets[index];

        if (this.storedInstructions.get(index)) {
            const color = this.storedInstructions.get(index).isMemoryOperation() ?
                ComputerChipMacro.MEMORY_COLOR : ComputerChipMacro.ALU_COLOR;
            return DrawUtils.buildTextMesh(this.storedInstructions.get(index).toString(), xOffset, yOffset,
                ComputerChipMacro.TEXT_SIZE, color, true, this.horizontal ? Math.PI / 2 : 0
            );
        } else { // using instancing to save memory
            return this.noOpMesh.clone().translateX(xOffset).translateY(yOffset);
        }
    }

    private shiftMeshesDown(nPositions: number): void {
        if (nPositions <= 0)
            throw new Error("Cannot shift down by a negative number of positions");
        if (nPositions > this.size)
            throw new Error("Cannot shift down by more than the size of the buffer");

        this.meshes.splice(0, nPositions).forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });

        if (this.horizontal) {
            this.meshes.forEach((mesh, index) =>
                mesh.translateX(-this.bufferMeshOffsets[index + nPositions] + this.bufferMeshOffsets[index])
            );
        } else {
            this.meshes.forEach((mesh, index) =>
                mesh.translateY(-this.bufferMeshOffsets[index + nPositions] + this.bufferMeshOffsets[index])
            );
        }

        // Fill the empty spaces with noOpMesh
        for (let i = this.size; i > this.size - nPositions; --i) {
            const offsetIndex = i - 1;
            this.meshes[offsetIndex] = this.noOpMesh.clone()
                .translateX(this.horizontal ? this.bufferMeshOffsets[offsetIndex] : this.position.x)
                .translateY(this.horizontal ? this.position.y : this.bufferMeshOffsets[offsetIndex]);
            this.scene.add(this.meshes[offsetIndex]);
        }
    }

    private highlightBuffer(index: number): void {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");

        this.clearHighlights();
        const color = this.storedInstructions.get(index).isMemoryOperation() ?
            ComputerChipMacro.MEMORY_COLOR : ComputerChipMacro.ALU_COLOR;

        const highlightMesh = new Mesh(this.bufferHighlightGeometry, color);
        highlightMesh.position.set(this.horizontal ? this.bufferMeshOffsets[index] : this.position.x,
            this.horizontal ? this.position.y : this.bufferMeshOffsets[index], 0.01);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.meshes[index].material = ComputerChipMacro.COMPONENT_COLOR;
    }

    private clearHighlights(): void {
        this.highlightMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.highlightMeshes = [];
    }

    private buildBufferMeshes(): Mesh {
        const startOffset = this.horizontal
            ? this.position.x + (this.reversed ? -1 : 1) * (this.rectangleSize / 2 - this.width / 2)
            : this.position.y + (this.reversed ? -1 : 1) * (this.rectangleSize / 2 - this.height / 2);

        let geometries = [];
        for (let i = 0; i < this.size; ++i) {
            const offset = startOffset + (this.reversed ? -1 : 1) * i * (this.rectangleSize + this.spacing);
            const geometry = new PlaneGeometry(this.horizontal ? this.rectangleSize :
                this.width, this.horizontal ? this.height : this.rectangleSize);

            this.horizontal ? geometry.translate(offset, this.position.y, 0) :
                geometry.translate(this.position.x, offset, 0);

            this.bufferMeshOffsets.push(offset);
            geometries.push(geometry);
        }

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, true);
        if (!mergedGeometry)
            throw new Error("Failed to merge geometries");
        return new Mesh(mergedGeometry, ComputerChipMacro.COMPONENT_COLOR);
    }
}