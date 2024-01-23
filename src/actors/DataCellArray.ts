import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "./ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {DrawUtils} from "../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

export class DataCellArray extends ComputerChipMacro {
    protected static readonly REGISTER_SIDE_LENGTH: number = 0.11;
    private static readonly INNER_SPACING = 0.01;

    private readonly cellPositions: [number, number][] = [];
    private readonly cellHighlightGeometry: PlaneGeometry;

    private readonly numberOfWords: number;
    private readonly wordSize: number;
    private readonly memoryArray: number[];
    private readonly bankName?: string;

    private ready: boolean = false;
    private highlightedMemoryCell: number = 0;
    private memoryOperationTimeout: number = 0;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, numberOfWords: number = 4, wordSize: number = 4,
                bankName?: string) {
        super(parent, xOffset, yOffset);
        this.numberOfWords = numberOfWords;
        this.wordSize = wordSize;
        this.bankName = bankName;
        this.memoryArray = new Array(this.numberOfWords * this.wordSize);
        for (let i = 0; i < this.memoryArray.length; i++)
            this.memoryArray[i] = 0;
        this.width = DataCellArray.REGISTER_SIDE_LENGTH * this.numberOfWords
            + DataCellArray.INNER_SPACING * (this.numberOfWords - 1);
        this.height = DataCellArray.REGISTER_SIDE_LENGTH * this.wordSize
            + DataCellArray.INNER_SPACING * (this.wordSize - 1);
        this.cellHighlightGeometry = new PlaneGeometry(DataCellArray.REGISTER_SIDE_LENGTH, DataCellArray.REGISTER_SIDE_LENGTH);

    }

    public getSize(): number {
        return this.memoryArray.length;
    }

    public isReady(): boolean {
        return this.ready;
    }

    public askForMemoryOperation(chip: ComputerChip, address: number): void {
        if (this.memoryOperationTimeout > 0)
            return;
        this.ready = false;
        this.highlightCell(address);
        this.memoryOperationTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
    }

    public read(address: number): number {
        this.ensureAddressIsInBounds(address);
        this.checkIfReady();
        this.ready = false;
        this.clearHighlights();
        return this.memoryArray[address];
    }

    public write(address: number, value: number): void {
        this.ensureAddressIsInBounds(address);
        this.checkIfReady();
        this.memoryArray[address] = value;
        DrawUtils.updateText(this.liveMeshes[address], value.toString(), true);
        this.clearHighlights();
        this.ready = false;
    }

    update(): void {
        if (this.memoryOperationTimeout > 0) {
            this.memoryOperationTimeout--;
            this.ready = this.memoryOperationTimeout <= 0;
        }
    }

    initializeGraphics(): void {
        const [registerMesh, registerNamesMesh] = this.buildDataCellMeshes();
        this.addStaticMesh(registerMesh);
        this.addStaticMesh(registerNamesMesh);
        if (this.bankName) {
            const bankNameMesh = DrawUtils.buildTextMesh(this.bankName, this.position.x,
                this.position.y + this.height / 2 + DrawUtils.baseTextHeight / 2, DataCellArray.TEXT_SIZE , ComputerChipMacro.TEXT_COLOR, true);
            this.addStaticMesh(bankNameMesh);
        }

        for (let i = 0; i < this.memoryArray.length; i++) {
            const contentMesh = this.buildDataCellContentsMesh(i);
            this.liveMeshes.push(contentMesh);
            this.scene.add(contentMesh);
        }
        this.highlightCell(0)
        this.clearHighlights();
    }

    dispose() {
        super.dispose();
        this.cellHighlightGeometry.dispose();
    }

    clearHighlights() {
        super.clearHighlights();
        if (this.highlightedMemoryCell >= 0) {
            this.liveMeshes[this.highlightedMemoryCell].material = ComputerChipMacro.TEXT_COLOR;
            this.highlightedMemoryCell = -1;
        }
    }

    private buildDataCellContentsMesh(index: number): Mesh {
        if (index < 0 || index >= this.memoryArray.length)
            throw new Error("Index out of bounds");

        if (this.memoryArray[index] == 0) {
            const position = this.cellPositions[index];
            const textMesh = DrawUtils.buildTextMesh(
                this.memoryArray[index].toString(), position[0], position[1] - DataCellArray.REGISTER_SIDE_LENGTH / 2 + DrawUtils.baseTextHeight / 2
                , DataCellArray.TEXT_SIZE, ComputerChipMacro.TEXT_COLOR, false);
            textMesh.geometry.center();
            return textMesh;
        } else
            throw new Error("No data to display");
    }

    private highlightCell(index: number): void {
        if (index < 0 || index >= this.memoryArray.length)
            throw new Error("Index out of bounds");

        this.clearHighlights();

        const highlightMesh = new Mesh(this.cellHighlightGeometry, ComputerChipMacro.MEMORY_COLOR);
        const position = this.cellPositions[index];
        highlightMesh.position.set(position[0], position[1], 0);
        this.highlightedMemoryCell = index;
        this.liveMeshes[index].material = ComputerChipMacro.BODY_COLOR;
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
    }

    private buildDataCellMeshes(registerNames?: string[]): [Mesh, Mesh] {
        const startX = this.position.x - this.width / 2 + DataCellArray.REGISTER_SIDE_LENGTH / 2;
        const startY = this.position.y + this.height / 2 - DataCellArray.REGISTER_SIDE_LENGTH / 2;

        const registerGeometries = [];
        const registerNamesGeometries = [];

        for (let i = 0; i < this.wordSize; i++) {
            for (let j = 0; j < this.numberOfWords; j++) {
                const xOffset = startX + j * (DataCellArray.REGISTER_SIDE_LENGTH + DataCellArray.INNER_SPACING);
                const yOffset = startY - i * (DataCellArray.REGISTER_SIDE_LENGTH + DataCellArray.INNER_SPACING);

                const registerGeometry = this.cellHighlightGeometry.clone();
                registerGeometry.translate(xOffset, yOffset, 0);
                registerGeometries.push(registerGeometry);

                const registerName = registerNames ? registerNames[i * this.numberOfWords + j] :
                    DrawUtils.toHex(i * this.numberOfWords + j);
                const registerNameGeometry = DrawUtils.buildTextMesh(registerName, 0, 0,
                    DataCellArray.TEXT_SIZE / 2, DataCellArray.BODY_COLOR).geometry.center()
                    .translate(xOffset, yOffset + DataCellArray.REGISTER_SIDE_LENGTH / 2 - DrawUtils.baseTextHeight / 4, 0)
                registerNamesGeometries.push(registerNameGeometry);

                this.cellPositions.push([xOffset, yOffset]);
            }
        }
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(registerGeometries, true);
        const mergedNamesGeometry = BufferGeometryUtils.mergeGeometries(registerNamesGeometries, true);
        if (!mergedGeometry || !mergedNamesGeometry)
            throw new Error("Failed to merge geometries");
        return [new Mesh(mergedGeometry, ComputerChipMacro.COMPONENT_COLOR),
            new Mesh(mergedNamesGeometry, ComputerChipMacro.BODY_COLOR)];
    }

    private ensureAddressIsInBounds(address: number): void {
        if (address >= this.memoryArray.length || address < 0)
            throw new Error("Address " + address + " is out of bounds for data array from " + this.parent.displayName());
    }

    private checkIfReady(): void {
        if (!this.ready)
            throw new Error("Data array from " + this.parent.displayName() + " is not ready to be read");
    }
}