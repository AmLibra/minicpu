import {ComputerChipMacro} from "./ComputerChipMacro";
import {Mesh, PlaneGeometry} from "three";
import {Queue} from "../../components/Queue";
import {Instruction} from "../../components/Instruction";
import {ComputerChip} from "../ComputerChip";
import {DrawUtils} from "../../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class InstructionBuffer extends ComputerChipMacro {
    public static readonly BUFFER_HEIGHT: number = 0.11;
    protected static readonly BUFFER_BASE_WIDTH: number = 0.8;
    private static readonly INNER_SPACING = 0.01;
    protected readonly noOpMesh: Mesh;
    private readonly bufferHighlightGeometry: PlaneGeometry;

    private readonly spacing: number;
    private readonly rectangleSize: number;
    protected bufferMeshOffsets: number[] = [];

    public readonly size: number;

    protected readonly storedInstructions: Queue<Instruction>;
    protected readonly reversed: boolean;
    protected readonly horizontal: boolean;

    protected readyToBeRead: boolean = false;
    protected readTimeout: number = 0;
    protected readonly noDelay: boolean;

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

    public askForInstructions(chip: ComputerChip, n: number): void {
        if (this.noDelay)
            throw new Error("There is no need to ask for instructions when there is no delay");
        if (this.readTimeout > 0)
            return;

        for (let i = 0; i < n; ++i)
            if (this.storedInstructions.get(i))
                this.highlightBuffer(i);

        this.readTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
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
        this.clearHighlights();
        this.readyToBeRead = false;
        return instructionsToRead;
    }

    public write(instructions: Queue<Instruction>, writeCount = instructions.size()): void {
        if (writeCount > this.size)
            throw new Error("Cannot write more instructions than the size of the buffer");

        const oldSize = this.storedInstructions.size();
        instructions.moveTo(this.storedInstructions, writeCount);
        for (let i = oldSize; i < this.storedInstructions.size(); ++i) {
            this.scene.remove(this.liveMeshes[i]);
            this.liveMeshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.liveMeshes[i]);
        }
    }

    update(): void {
        if (this.noDelay)
            throw new Error("No delay instruction buffers do not need to be updated");
        if (this.readTimeout > 0 && this.storedInstructions.size() > 0) {
            --this.readTimeout;
            this.readyToBeRead = this.readTimeout <= 0;
        }
    }

    initializeGraphics(): void {
        this.addStaticMesh(this.buildBuffersMesh());
        for (let i = 0; i < this.size; ++i) {
            this.liveMeshes[i] = this.buildBufferTextMesh(i);
            this.scene.add(this.liveMeshes[i]);
        }
    }

    dispose(): void {
        super.dispose();
        this.bufferHighlightGeometry.dispose();
        this.noOpMesh.geometry.dispose();
    }

    protected buildBufferTextMesh(index: number, replaceString?: string): Mesh {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");

        const xOffset = this.horizontal ? this.bufferMeshOffsets[index] : this.position.x;
        const yOffset = this.horizontal ? this.position.y : this.bufferMeshOffsets[index];

        if (this.storedInstructions.get(index)) {
            const color = this.storedInstructions.get(index).isMemoryOperation() ?
                ComputerChipMacro.MEMORY_COLOR : (this.storedInstructions.get(index).isArithmetic() ?
                    ComputerChipMacro.ALU_COLOR : ComputerChipMacro.BRANCH_COLOR);
            return DrawUtils.buildTextMesh( (replaceString ? replaceString : this.storedInstructions.get(index).toString())
                , xOffset, yOffset,
                ComputerChipMacro.TEXT_SIZE, color, true, this.horizontal ? Math.PI / 2 : 0
            );
        } else { // using instancing to save memory
            return this.noOpMesh.clone().translateX(xOffset).translateY(yOffset);
        }
    }

    protected shiftMeshesDown(nPositions: number): void {
        if (nPositions <= 0)
            throw new Error("Cannot shift down by a negative number of positions");
        if (nPositions > this.size)
            throw new Error("Cannot shift down by more than the size of the buffer");

        this.liveMeshes.splice(0, nPositions).forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });

        if (this.horizontal) {
            this.liveMeshes.forEach((mesh, index) =>
                mesh.translateX(-this.bufferMeshOffsets[index + nPositions] + this.bufferMeshOffsets[index])
            );
        } else {
            this.liveMeshes.forEach((mesh, index) =>
                mesh.translateY(-this.bufferMeshOffsets[index + nPositions] + this.bufferMeshOffsets[index])
            );
        }

        // Fill the empty spaces with noOpMesh
        for (let i = this.size - 1; i > this.size - nPositions - 1; --i) {
            this.liveMeshes[i] = this.noOpMesh.clone()
                .translateX(this.horizontal ? this.bufferMeshOffsets[i] : this.position.x)
                .translateY(this.horizontal ? this.position.y : this.bufferMeshOffsets[i]);
            this.scene.add(this.liveMeshes[i]);
        }
    }

    protected highlightBuffer(index: number): void {
        if (index < 0 || index >= this.size)
            throw new Error("Index out of bounds");

        this.clearHighlights();
        const color = this.storedInstructions.get(index).isMemoryOperation() ?
            ComputerChipMacro.MEMORY_COLOR : (this.storedInstructions.get(index).isArithmetic() ?
                ComputerChipMacro.ALU_COLOR : ComputerChipMacro.BRANCH_COLOR);

        const highlightMesh = new Mesh(this.bufferHighlightGeometry, color);
        highlightMesh.position.set(this.horizontal ? this.bufferMeshOffsets[index] : this.position.x,
            this.horizontal ? this.position.y : this.bufferMeshOffsets[index], 0.01);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.liveMeshes[index].material = ComputerChipMacro.COMPONENT_COLOR;
    }

    protected buildBuffersMesh(): Mesh {
        const startOffset = this.horizontal
            ? this.position.x + (this.reversed ? -1 : 1) * (this.rectangleSize / 2 - this.width / 2)
            : this.position.y + (this.reversed ? -1 : 1) * (this.rectangleSize / 2 - this.height / 2);

        let geometries = [];
        for (let i = 0; i < this.size; ++i) {
            const offset = startOffset + (this.reversed ? -1 : 1) * i * (this.rectangleSize + this.spacing);
            const geometry = this.bufferHighlightGeometry.clone();

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