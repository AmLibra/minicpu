import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../../ComputerChip";
import {BufferGeometry, Mesh, MeshBasicMaterial, PlaneGeometry} from "three";
import {DrawUtils} from "../../../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import {ALU} from "./ALU";

/**
 * Represents an array of data cells, used to simulate memory or registers within a computer chip simulation.
 */
export class DataCellArray extends ComputerChipMacro {
    public static readonly BUFFER_HEIGHT: number = 0.11;
    protected static readonly BUFFER_WIDTH: number = 0.3;

    /** The spacing between each cell in the array. */
    private static readonly INNER_SPACING = 0.01;

    /** The initial value with which each register in the array is filled. */
    private static readonly INITIAL_REG_VALUE: number = 0;

    private readonly initialTextMaterial = ComputerChipMacro.TEXT_MATERIAL.clone();
    private readonly recentlyUpdatedMeshes: Mesh[] = [];

    /** An array of tuples representing the x and y positions of each cell in the 3D space. */
    private readonly cellPositions: [number, number][] = [];

    /** The geometry used for highlighting a cell in the array. */
    private readonly cellHighlightGeometry: PlaneGeometry;

    /** The number of words (groups of cells) in the array. */
    private readonly numberOfWords: number;


    /** An array representing the memory values stored in each cell. */
    private readonly memoryArray: number[];

    /** Optional name for the bank of registers or memory array. */
    private readonly bankName?: string;

    /** Optional array of names for each register within the array. */
    private readonly registerNames?: string[];

    /** Flag indicating whether memory operations should be instant without any delay. */
    private readonly delay: number;

    /** The zero register index. */
    private readonly zeroRegister: number | undefined;

    /** Indicates whether the data cell array is ready for a read or write operation. */
    private ready: boolean = false;

    /** The index of the currently highlighted memory cell, if any. */
    private highlightedMemoryCell: number = -1;

    /** A timeout counter used to simulate operation delay. */
    private memoryOperationTimeout: number = 0;

    /**
     * Constructs a new DataCellArray instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset in the 3D space where the data cell array should be positioned.
     * @param yOffset The y-offset in the 3D space where the data cell array should be positioned.
     * @param numberOfWords The number of words in the data cell array.
     * @param delay The memory operation delay in clock cycles.
     * @param zeroRegister The index of the zero register in the array.
     * @param registerNames An optional array of names for each register in the array.
     * @param bankName An optional name for the bank of registers or memory array.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, numberOfWords: number = 4,
                delay: number = 0, zeroRegister: number | undefined, registerNames?: string[], bankName?: string) {
        super(parent, xOffset, yOffset);
        this.numberOfWords = numberOfWords;
        this.delay = delay;
        this.zeroRegister = zeroRegister;
        this.bankName = bankName;
        this.registerNames = registerNames;
        this.memoryArray = new Array(this.numberOfWords).fill(DataCellArray.INITIAL_REG_VALUE);
        this.width = DataCellArray.BUFFER_WIDTH;
        this.height = DataCellArray.BUFFER_HEIGHT * numberOfWords + DataCellArray.INNER_SPACING * (numberOfWords - 1);
        this.cellHighlightGeometry = new PlaneGeometry(DataCellArray.BUFFER_WIDTH, DataCellArray.BUFFER_HEIGHT);
        this.initialTextMaterial.transparent = true;
        this.initialTextMaterial.opacity = 0.2;
    }

    /**
     * Computes the dimensions of the data cell array based on the number of words and the word size.
     * This is useful for positioning the data cell array in the scene relative to other dataStructures.
     *
     * @param numberOfWords The number of words in the data cell array.
     */
    public static dimensions(numberOfWords: number): { width: number, height: number } {
        return {
            width: DataCellArray.BUFFER_WIDTH,
            height: DataCellArray.BUFFER_HEIGHT * numberOfWords + DataCellArray.INNER_SPACING * (numberOfWords - 1)
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
        if (this.delay == 0) return true;
        return this.ready;
    }

    /**
     * Asks the data cell array to perform a memory operation (read or write) at the given address.
     *
     * @param chip The chip that is asking for the memory operation
     * @param address The address of the memory operation
     */
    public askForMemoryOperation(chip: ComputerChip, address: number): void {
        if (this.delay == 0)
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
        if (address === this.zeroRegister)
            return;
        this.memoryArray[address] = value;
        DrawUtils.updateText(this.liveMeshes[address], DrawUtils.toHex(value), true);
        this.clearHighlights();
        if (this.delay == 0)
            this.highlightCell(address, chipMacro);
        this.ready = false;
    }

    update(): void {
        if (this.memoryOperationTimeout > 0) {
            this.memoryOperationTimeout--;
            this.ready = this.memoryOperationTimeout <= 0;
        }
        if (this.delay == 0 && this.highlightMeshes.length > 0)
            this.clearHighlights();
        if (this.recentlyUpdatedMeshes.length > 0) {
            const toRemove: number[] = [];
            this.recentlyUpdatedMeshes.forEach((mesh, index) => {
                const baseMaterial = mesh.material as MeshBasicMaterial;
                if (!baseMaterial.transparent) {
                    baseMaterial.transparent = true;
                }
                baseMaterial.opacity -= 0.01;
                if (baseMaterial.opacity <= this.initialTextMaterial.opacity) {
                    baseMaterial.opacity = this.initialTextMaterial.opacity;
                    toRemove.push(index);
                }
                DrawUtils.updateMaterial(mesh, baseMaterial);
            });
            toRemove.forEach(index => this.recentlyUpdatedMeshes.splice(index, 1));
        }
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
            this.liveMeshes[this.highlightedMemoryCell].material = ComputerChipMacro.TEXT_MATERIAL.clone()
            if (!this.recentlyUpdatedMeshes.includes(this.liveMeshes[this.highlightedMemoryCell])) {
                this.recentlyUpdatedMeshes.push(this.liveMeshes[this.highlightedMemoryCell]);
            }
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
                DrawUtils.toHex(this.memoryArray[index]), position[0], position[1] - DataCellArray.BUFFER_HEIGHT / 2 + DrawUtils.baseTextHeight / 2
                , DataCellArray.TEXT_SIZE, this.initialTextMaterial.clone(), false);
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

        this.liveMeshes[index].material = ComputerChipMacro.BODY_MATERIAL; // back to normal opacity

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
        return this.position.x - this.width / 2 + DataCellArray.BUFFER_WIDTH / 2;
    }

    /**
     * Returns the y-coordinate of the start position of the data cell array.
     * @private
     */
    private getStartPositionY(): number {
        return this.position.y - this.height / 2 + DataCellArray.BUFFER_HEIGHT / 2;
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
        for (let i = 0; i < this.numberOfWords; i++) {
            const yOffset = startY + i * (DataCellArray.BUFFER_HEIGHT + DataCellArray.INNER_SPACING);
            this.createCellGeometry(registerGeometries, startX, yOffset);
            this.createNameGeometry(registerNamesGeometries, registerNames, i, startX, yOffset);
            this.cellPositions.push([startX, yOffset]);
        }
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
     * @param index The index of the column in the array.
     * @param xOffset The x-offset for the register name.
     * @param yOffset The y-offset for the register name.
     * @private
     */
    private createNameGeometry(registerNamesGeometries: BufferGeometry[], registerNames: string[] | undefined, index: number, xOffset: number, yOffset: number): void {
        const registerName = registerNames ? registerNames[index] : DrawUtils.toHex(index);
        const registerNameGeometry =
            DrawUtils.buildTextMesh(registerName, 0, 0, DataCellArray.TEXT_SIZE / 2, DataCellArray.BODY_MATERIAL).geometry.center()
                     .translate(xOffset, yOffset + DataCellArray.BUFFER_HEIGHT / 2 - DrawUtils.baseTextHeight / 4, 0);
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
        if (!(this.delay === 0) && !this.ready)
            throw new Error("Data array from " + this.parent.displayName() + " is not ready to be read");
    }
}