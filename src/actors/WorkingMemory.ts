import {ComputerChip, Side} from "./ComputerChip";
import {Scene} from "three";
import {DataCellArray} from "./macros/primitives/DataCellArray";
import {DrawUtils} from "../DrawUtils";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";
import {UpgradeOption} from "../dataStructures/UpgradeOption";
import {App} from "../app";

/**
 * Represents the working memory of a computer chip, consisting of multiple data banks.
 */
export class WorkingMemory extends ComputerChip {
    public readonly size: number;
    public readonly numberOfBanks: number;
    public readonly numberOfWords: number;

    private dataBanks: DataCellArray[] = [];
    private static readonly BANK_SPACING: number = 0.04;
    private static readonly DELAY: number = 10;
    private connectedChip: ComputerChip;

    /**
     * Constructs a new WorkingMemory instance.
     *
     * @param app The main application class.
     * @param clockFrequency The clock frequency of the working memory.
     * @param numberOfBanks The number of data banks in the working memory.
     * @param numberOfWords The number of words in each data bank.
     */
    constructor(private app: App, clockFrequency: number, numberOfBanks: number = 2, numberOfWords: number = 4) {
        super([0, 0], app.scene, clockFrequency);
        this.numberOfWords = numberOfWords;
        this.numberOfBanks = numberOfBanks;
        this.size = numberOfBanks * numberOfWords;
    }

    /**
     * Computes the dimensions of the instruction memory
     */
    public dimensions(): { width: number, height: number } {
        const cellArrayDims = DataCellArray.dimensions(this.numberOfWords);
        return {
            width: cellArrayDims.width * this.numberOfBanks + WorkingMemory.BANK_SPACING * (this.numberOfBanks - 1) + WorkingMemory.CONTENTS_MARGIN * 2,
            height: cellArrayDims.height + WorkingMemory.CONTENTS_MARGIN * 2 + WorkingMemory.INNER_SPACING + WorkingMemory.TEXT_SIZE
        }
    }

    /**
     * Changes the position of the instruction memory.
     */
    public setPosition(position: [number, number]): void {
        this.position = {x: position[0], y: position[1]};
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
        this.connectedChip = chip;
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

    getMenuOptions(): ChipMenuOptions {
        if (!this.chipMenuOptions) {
            const stats = [];
            const upgradeOptions = [
                UpgradeOption.createNumberSelection("Clock Frequency", 0,
                    "The clock frequency of the chip.", this.getClockFrequency(),
                    () => this.safeIncrementClock(),
                    () => this.safeDecrementClock()),
            ];
            this.chipMenuOptions = new ChipMenuOptions(stats, upgradeOptions);
        }
        return this.chipMenuOptions;
    }

    displayName(): string {
        return "Main Memory";
    }

    update(): void {
        this.dataBanks.forEach(dataBank => dataBank.update());
    }

    initializeGraphics(): void {
        const cellArrayDimensions = DataCellArray.dimensions(this.numberOfWords);
        const bodyHeight = cellArrayDimensions.height + WorkingMemory.CONTENTS_MARGIN * 2
            + WorkingMemory.INNER_SPACING + WorkingMemory.TEXT_SIZE;
        let bodyWidth = cellArrayDimensions.width * this.numberOfBanks + WorkingMemory.CONTENTS_MARGIN * 2
            + (this.numberOfBanks - 1) * WorkingMemory.BANK_SPACING;

        const startOffset = -bodyWidth / 2 + cellArrayDimensions.width / 2 + WorkingMemory.CONTENTS_MARGIN;
        const bankSize = this.numberOfWords;
        for (let i = 0; i < this.numberOfBanks; i++) {
            const cellNames : string[] = [];
            for (let j = 0; j < bankSize; j++)
                cellNames.push(DrawUtils.toHex(i * bankSize + j));

            const dataBank = new DataCellArray(this,
                startOffset + i * (cellArrayDimensions.width + WorkingMemory.BANK_SPACING),
                (-WorkingMemory.INNER_SPACING - WorkingMemory.TEXT_SIZE) / 2,
                this.numberOfWords, WorkingMemory.DELAY, undefined, cellNames, `DB${i}`);
            dataBank.initializeGraphics();
            this.dataBanks[i] = dataBank;
        }

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh!, Side.BOTTOM, this.numberOfBanks);
    }

    disposeGraphics(): void {
        super.disposeBodyMesh();
        this.clearTracesAndPins(Side.BOTTOM);
        this.dataBanks.forEach(dataBank => dataBank.dispose());
        this.app.removeGameActor(this);
    }

    /**
     * Retrieves the data bank responsible for the specified address.
     *
     * @param address The memory address to locate the corresponding data bank for.
     * @returns The data bank containing the specified address.
     */
    private bankOf(address: number): DataCellArray {
        return this.dataBanks[Math.floor(address / this.numberOfWords)];
    }

    /**
     * Safely increments the clock frequency of the working memory.
     *
     * @private
     */
    private safeIncrementClock(): number {
        if (this.connectedChip && (this.getClockFrequency() < (this.connectedChip.getClockFrequency() / 3)))
            return this.updateClock(this.getClockFrequency() + 1)
        else
            return this.getClockFrequency()
    }

    /**
     * Safely decrements the clock frequency of the working memory.
     *
     * @private
     */
    private safeDecrementClock(): number {
        if (this.getClockFrequency() > 1)
            return this.updateClock(this.getClockFrequency() - 1)
        else
            return this.getClockFrequency()
    }
}
