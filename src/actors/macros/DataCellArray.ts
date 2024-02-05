import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {BufferGeometry, Mesh, PlaneGeometry} from "three";
import {DrawUtils} from "../../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import {ALU} from "./ALU";

/**
 * Represents an array of data cells, used to simulate memory or registers within a computer chip simulation.
 */
export class DataCellArray extends ComputerChipMacro {
    /** The side length of each register cell in the array. */
    private static readonly REGISTER_SIDE_LENGTH: number = 0.11;

    /** The spacing between each cell in the array. */
    private static readonly INNER_SPACING = 0.01;

    /** The initial value with which each register in the array is filled. */
    private static readonly INITIAL_REG_VALUE: number = 2;

    /** An array of tuples representing the x and y positions of each cell in the 3D space. */
    private readonly cellPositions: [number, number][] = [];

    /** The geometry used for highlighting a cell in the array. */
    private readonly cellHighlightGeometry: PlaneGeometry;

    /** The number of words (groups of cells) in the array. */
    private readonly numberOfWords: number;

    /** The size of each word, in cells. */
    private readonly wordSize: number;

    /** An array representing the memory values stored in each cell. */
    private readonly memoryArray: number[];

    /** Optional name for the bank of registers or memory array. */
    private readonly bankName?: string;

    /** Optional array of names for each register within the array. */
    private readonly registerNames?: string[];

    /** Flag indicating whether memory operations should be instant without any delay. */
    private readonly noDelay: boolean;

    /** Indicates whether the data cell array is ready for a read or write operation. */
    private ready: boolean = false;

    /** The index of the currently highlighted memory cell, if any. */
    private highlightedMemoryCell: number = 0;

    /** A timeout counter used to simulate operation delay. */
    private memoryOperationTimeout: number = 0;

    /**
     * Constructs a new DataCellArray instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset in the 3D space where the data cell array should be positioned.
     * @param yOffset The y-offset in the 3D space where the data cell array should be positioned.
     * @param numberOfWords The number of words in the data cell array.
     * @param wordSize The number of cells in each word.
     * @param noDelay Whether the data cell array should operate without any simulated delay.
     * @param registerNames An optional array of names for each register in the array.
     * @param bankName An optional name for the bank of registers or memory array.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, numberOfWords: number = 4, wordSize: number = 4,
                noDelay: boolean = false, registerNames?: string[], bankName?: string) {
        super(parent, xOffset, yOffset);
        this.numberOfWords = numberOfWords;
        this.wordSize = wordSize;
        this.noDelay = noDelay;
        this.bankName = bankName;
        this.registerNames = registerNames;
        this.memoryArray = new Array(this.numberOfWords * this.wordSize).fill(DataCellArray.INITIAL_REG_VALUE);
        this.width = DataCellArray.REGISTER_SIDE_LENGTH * this.numberOfWords
            + DataCellArray.INNER_SPACING * (this.numberOfWords - 1);
        this.height = DataCellArray.REGISTER_SIDE_LENGTH * this.wordSize
            + DataCellArray.INNER_SPACING * (this.wordSize - 1);
        this.cellHighlightGeometry = new PlaneGeometry(DataCellArray.REGISTER_SIDE_LENGTH, DataCellArray.REGISTER_SIDE_LENGTH);
    }

    /**
     * Computes the dimensions of the data cell array based on the number of words and the word size.
     * This is useful for positioning the data cell array in the scene relative to other components.
     *
     * @param numberOfWords
     * @param wordSize
     */
    public static computeDimensions(numberOfWords: number, wordSize: number): { width: number, height: number } {
        return {
            width: DataCellArray.REGISTER_SIDE_LENGTH * numberOfWords + DataCellArray.INNER_SPACING * (numberOfWords - 1),
            height: DataCellArray.REGISTER_SIDE_LENGTH * wordSize + DataCellArray.INNER_SPACING * (wordSize - 1)
        }
    }

    /**
     * Returns the size (number of elements) of the data cell array.
     *
     * @returns {number}
     */
    public getSize(): number {
        return this.memoryArray.length;
    }

    /**
     * True if the data cell array is ready to be read from or written to.
     *
     * @returns {boolean}
     */
    public isReady(): boolean {
        if (this.noDelay) return true;
        return this.ready;
    }

    /**
     * Asks the data cell array to perform a memory operation (read or write) at the given address.
     *
     * @param chip The chip that is asking for the memory operation
     * @param address The address of the memory operation
     */
    public askForMemoryOperation(chip: ComputerChip, address: number): void {
        if (this.noDelay)
            throw new Error("There is no need to ask for memory operations when there is no delay");
        if (this.memoryOperationTimeout > 0)
            return;
        this.ready = false;
        this.highlightCell(address);
        this.memoryOperationTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
    }

    /**
     * Reads the value at the given address from the data cell array.
     *
     * @param address The address to read from
     * @returns {number} The value at the given address
     * @throws {Error} If the address is out of bounds or the data cell array is not ready to be read from
     */
    public read(address: number): number {
        this.ensureAddressIsInBounds(address);
        this.checkIfReady();
        this.ready = false;
        this.clearHighlights();
        return this.memoryArray[address];
    }

    /**
     * Writes the given value to the given address in the data cell array.
     *
     * @param address The address to write to
     * @param value The value to write
     * @param chipMacro The chip that is writing the value
     * @throws {Error} If the address is out of bounds or the data cell array is not ready to be written to
     */
    public write(address: number, value: number, chipMacro?: ComputerChipMacro): void {
        this.ensureAddressIsInBounds(address);
        this.checkIfReady();
        this.memoryArray[address] = value;
        DrawUtils.updateText(this.liveMeshes[address], value.toString(), true);
        this.clearHighlights();
        if (this.noDelay)
            this.highlightCell(address, chipMacro);
        this.ready = false;
    }

    update(): void {
        if (this.memoryOperationTimeout > 0) {
            this.memoryOperationTimeout--;
            this.ready = this.memoryOperationTimeout <= 0;
        }
        if (this.noDelay && this.highlightMeshes.length > 0)
            this.clearHighlights();
    }

    initializeGraphics(): void {
        this.addStaticMeshes(...this.buildDataCellMeshes(this.registerNames));
        if (this.bankName)
            this.addStaticMesh(DrawUtils.buildTextMesh(this.bankName, this.position.x, this.position.y
                + this.height / 2 + DrawUtils.baseTextHeight / 2, DataCellArray.TEXT_SIZE,
                ComputerChipMacro.TEXT_MATERIAL, true)
            );

        for (let i = 0; i < this.memoryArray.length; i++)
            this.addLiveMesh(this.buildDataCellContentsMesh(i));
    }

    dispose() {
        super.dispose();
        this.cellHighlightGeometry.dispose();
    }

    clearHighlights() {
        super.clearHighlights();
        if (this.highlightedMemoryCell >= 0 && this.liveMeshes[this.highlightedMemoryCell]) {
            this.liveMeshes[this.highlightedMemoryCell].material = ComputerChipMacro.TEXT_MATERIAL;
            this.highlightedMemoryCell = -1;
        }
    }

    /**
     * Builds the mesh for the contents of a data cell.
     *
     * @param index The index of the data cell in the memory array.
     * @private
     */
    private buildDataCellContentsMesh(index: number): Mesh {
        if (index < 0 || index >= this.memoryArray.length)
            throw new Error("Index out of bounds");

        if (this.memoryArray[index] == DataCellArray.INITIAL_REG_VALUE) {
            const position = this.cellPositions[index];
            const textMesh = DrawUtils.buildTextMesh(
                this.memoryArray[index].toString(), position[0], position[1] - DataCellArray.REGISTER_SIDE_LENGTH / 2 + DrawUtils.baseTextHeight / 2
                , DataCellArray.TEXT_SIZE, ComputerChipMacro.TEXT_MATERIAL, false);
            textMesh.geometry.center();
            return textMesh;
        } else
            throw new Error("No valid data to display (poor initialization ?)");
    }

    /**
     * Highlights a cell in the data cell array.
     *
     * @param index The index of the cell to highlight.
     * @param chipMacro The chip that is highlighting the cell.
     * @private
     */
    private highlightCell(index: number, chipMacro?: ComputerChipMacro): void {
        if (index < 0 || index >= this.memoryArray.length)
            throw new Error("Index out of bounds");

        this.clearHighlights();
        const color = chipMacro && chipMacro instanceof ALU ? ComputerChipMacro.ALU_MATERIAL : ComputerChipMacro.MEMORY_MATERIAL
        const highlightMesh = new Mesh(this.cellHighlightGeometry, color);
        const position = this.cellPositions[index];
        highlightMesh.position.set(position[0], position[1], 0);

        this.liveMeshes[index].material = ComputerChipMacro.BODY_MATERIAL;

        this.highlightedMemoryCell = index;
        this.addHighlightMesh(highlightMesh);
    }

    /**
     * Builds the meshes for the data cell array and its register names.
     *
     * @param registerNames An optional array of names for each register in the array.
     * @private
     */
    private buildDataCellMeshes(registerNames?: string[]): [Mesh, Mesh] {
        // Initialize start positions
        const startX = this.getStartPositionX();
        const startY = this.getStartPositionY();

        // Prepare arrays for geometries
        const registerGeometries: BufferGeometry[] = [];
        const registerNamesGeometries: BufferGeometry[] = [];

        // Generate geometries for registers and their names
        this.generateGeometries(registerGeometries, registerNamesGeometries, registerNames, startX, startY);

        // Merge geometries for efficiency
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(registerGeometries, true);
        const mergedNamesGeometry = BufferGeometryUtils.mergeGeometries(registerNamesGeometries, true);

        // Validate merged geometries
        if (!mergedGeometry || !mergedNamesGeometry) {
            throw new Error("Failed to merge geometries");
        }

        // Return meshes created from merged geometries
        return [
            new Mesh(mergedGeometry, ComputerChipMacro.COMPONENT_MATERIAL),
            new Mesh(mergedNamesGeometry, ComputerChipMacro.BODY_MATERIAL)
        ];
    }

    /**
     * Returns the x-coordinate of the start position of the data cell array.
     * @private
     */
    private getStartPositionX(): number {
        return this.position.x - this.width / 2 + DataCellArray.REGISTER_SIDE_LENGTH / 2;
    }

    /**
     * Returns the y-coordinate of the start position of the data cell array.
     * @private
     */
    private getStartPositionY(): number {
        return this.position.y + this.height / 2 - DataCellArray.REGISTER_SIDE_LENGTH / 2;
    }

    /**
     * Generates the geometries for the registers and their names.
     *
     * @param registerGeometries The array of geometries for the registers.
     * @param registerNamesGeometries The array of geometries for the register names.
     * @param registerNames An optional array of names for each register in the array.
     * @param startX The x-coordinate of the start position of the data cell array.
     * @param startY The y-coordinate of the start position of the data cell array.
     * @private
     */
    private generateGeometries(registerGeometries: BufferGeometry[], registerNamesGeometries: BufferGeometry[], registerNames: string[] | undefined, startX: number, startY: number): void {
        for (let i = 0; i < this.wordSize; i++) {
            for (let j = 0; j < this.numberOfWords; j++) {
                const [xOffset, yOffset] = this.calculateOffsets(startX, startY, i, j);
                this.createCellGeometry(registerGeometries, xOffset, yOffset);
                this.createNameGeometry(registerNamesGeometries, registerNames, i, j, xOffset, yOffset);
                this.cellPositions.push([xOffset, yOffset]);
            }
        }
    }

    /**
     * Calculates the x and y offsets for a register cell in the array.
     *
     * @param startX The x-coordinate of the start position of the data cell array.
     * @param startY The y-coordinate of the start position of the data cell array.
     * @param rowIndex The index of the row in the array.
     * @param columnIndex The index of the column in the array.
     * @private
     */
    private calculateOffsets(startX: number, startY: number, rowIndex: number, columnIndex: number): [number, number] {
        const xOffset = startX + columnIndex * (DataCellArray.REGISTER_SIDE_LENGTH + DataCellArray.INNER_SPACING);
        const yOffset = startY - rowIndex * (DataCellArray.REGISTER_SIDE_LENGTH + DataCellArray.INNER_SPACING);
        return [xOffset, yOffset];
    }

    /**
     * Creates the geometry for a register cell in the array.
     *
     * @param registerGeometries The array of geometries for the registers.
     * @param xOffset The x-offset for the register cell.
     * @param yOffset The y-offset for the register cell.
     * @private
     */
    private createCellGeometry(registerGeometries: BufferGeometry[], xOffset: number, yOffset: number): void {
        const registerGeometry = this.cellHighlightGeometry.clone();
        registerGeometry.translate(xOffset, yOffset, 0);
        registerGeometries.push(registerGeometry);
    }

    /**
     * Creates the geometry for the name of a register in the array.
     *
     * @param registerNamesGeometries The array of geometries for the register names.
     * @param registerNames An optional array of names for each register in the array.
     * @param rowIndex The index of the row in the array.
     * @param columnIndex The index of the column in the array.
     * @param xOffset The x-offset for the register name.
     * @param yOffset The y-offset for the register name.
     * @private
     */
    private createNameGeometry(registerNamesGeometries: BufferGeometry[], registerNames: string[] | undefined, rowIndex: number, columnIndex: number, xOffset: number, yOffset: number): void {
        const registerName = registerNames ? registerNames[rowIndex * this.numberOfWords + columnIndex] : DrawUtils.toHex(rowIndex * this.numberOfWords + columnIndex);
        const registerNameGeometry = DrawUtils.buildTextMesh(registerName, 0, 0, DataCellArray.TEXT_SIZE / 2, DataCellArray.BODY_MATERIAL).geometry.center()
            .translate(xOffset, yOffset + DataCellArray.REGISTER_SIDE_LENGTH / 2 - DrawUtils.baseTextHeight / 4, 0);
        registerNamesGeometries.push(registerNameGeometry);
    }

    /**
     * Ensures that the given address is within the bounds of the data array.
     * @param address The address to check.
     * @private
     * @throws {Error} If the address is out of bounds.
     */
    private ensureAddressIsInBounds(address: number): void {
        if (address >= this.memoryArray.length || address < 0)
            throw new Error("Address " + address + " is out of bounds for data array from " + this.parent.displayName());
    }

    /**
     * Checks if the data array is ready to be read from or written to.
     * @private
     * @throws {Error} If the data array is not ready.
     */
    private checkIfReady(): void {
        if (!this.noDelay && !this.ready)
            throw new Error("Data array from " + this.parent.displayName() + " is not ready to be read");
    }
}