import {ComputerChip, Side} from "./ComputerChip";
import {Scene} from "three";
import {DataCellArray} from "./macros/DataCellArray";
import {DrawUtils} from "../DrawUtils";

/**
 * Represents the working memory of a computer chip, consisting of multiple data banks.
 */
export class WorkingMemory extends ComputerChip {
    public readonly size: number;
    public readonly numberOfBanks: number;
    private readonly numberOfWords: number;
    private readonly wordSize: number;

    private dataBanks: DataCellArray[] = [];
    private static readonly BANK_SPACING: number = 0.04;

    /**
     * Constructs a new WorkingMemory instance.
     *
     * @param position The position of the working memory in the scene.
     * @param scene The Three.js scene to which the working memory will be added.
     * @param clockFrequency The clock frequency of the working memory.
     * @param numberOfBanks The number of data banks in the working memory.
     * @param numberOfWords The number of words in each data bank.
     * @param wordSize The size of each word in the data banks.
     */
    constructor(position: [number, number], scene: Scene, clockFrequency: number, numberOfBanks: number = 2, numberOfWords: number = 4, wordSize: number = 4) {
        super(position, scene, clockFrequency);
        this.numberOfWords = numberOfWords;
        this.numberOfBanks = numberOfBanks;
        this.wordSize = wordSize;
        this.size = numberOfBanks * numberOfWords * wordSize;
        this.initializeGraphics();
    }

    /**
     * Checks if the data bank containing the specified address is ready for operations.
     *
     * @param address The memory address to check.
     * @returns True if the bank is ready, false otherwise.
     */
    public isReady(address: number): boolean {
        return this.bankOf(address).isReady();
    }

    /**
     * Requests a memory operation on a specific address.
     *
     * @param chip The computer chip requesting the operation.
     * @param address The memory address on which the operation is requested.
     */
    public askForMemoryOperation(chip: ComputerChip, address: number): void {
        this.bankOf(address).askForMemoryOperation(chip, address % this.bankOf(address).getSize());
    }

    /**
     * Reads a value from a specific memory address.
     *
     * @param address The memory address to read from.
     * @returns The value stored at the specified address.
     */
    public read(address: number): number {
        return this.bankOf(address).read(address % this.bankOf(address).getSize());
    }

    /**
     * Writes a value to a specific memory address.
     *
     * @param address The memory address to write to.
     * @param value The value to be written.
     */
    public write(address: number, value: number): void {
        this.bankOf(address).write(address % this.bankOf(address).getSize(), value);
    }

    /**
     * Returns the display name of the working memory.
     *
     * @returns The display name.
     */
    displayName(): string {
        return "Main Memory";
    }

    /**
     * Updates the state of all data banks in the working memory.
     */
    update(): void {
        this.dataBanks.forEach(dataBank => dataBank.update());
    }

    /**
     * Initializes the graphical representation of the working memory.
     */
    private initializeGraphics(): void {
        const cellArrayDimensions = DataCellArray.computeDimensions(this.numberOfWords, this.wordSize);
        const bodyHeight = cellArrayDimensions.height + WorkingMemory.CONTENTS_MARGIN * 2
            + WorkingMemory.INNER_SPACING + WorkingMemory.TEXT_SIZE;
        let bodyWidth = cellArrayDimensions.width * this.numberOfBanks + WorkingMemory.CONTENTS_MARGIN * 2
            + (this.numberOfBanks - 1) * WorkingMemory.BANK_SPACING;

        const startOffset = -bodyWidth / 2 + cellArrayDimensions.width / 2 + WorkingMemory.CONTENTS_MARGIN;
        const bankSize = this.numberOfWords * this.wordSize;
        for (let i = 0; i < this.numberOfBanks; i++) {
            const cellNames = [];
            for (let j = 0; j < bankSize; j++)
                cellNames.push(DrawUtils.toHex(i * bankSize + j));

            const dataBank = new DataCellArray(this,
                startOffset + i * (cellArrayDimensions.width + WorkingMemory.BANK_SPACING),
                (-WorkingMemory.INNER_SPACING - WorkingMemory.TEXT_SIZE) / 2,
                 this.numberOfWords, this.wordSize,
                false, cellNames, `Bank ${i}`);
            dataBank.initializeGraphics();
            this.dataBanks[i] = dataBank;
        }

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh, Side.TOP, this.size);
    }

    /**
     * Retrieves the data bank responsible for the specified address.
     *
     * @param address The memory address to locate the corresponding data bank for.
     * @returns The data bank containing the specified address.
     */
    private bankOf(address: number): DataCellArray {
        return this.dataBanks[Math.floor(address / (this.numberOfWords * this.wordSize))];
    }
}
