import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {InstructionCacheLine} from "./InstructionCacheLine";
import {AddressedInstructionBuffer} from "./AddressedInstructionBuffer";
import {Instruction} from "../../dataStructures/Instruction";
import {MeshBasicMaterial} from "three";

/**
 * Represents the instruction cache of a computer chip, handling the caching of instructions.
 */
export class InstructionCache extends ComputerChipMacro {
    private readonly cacheLines: InstructionCacheLine[];
    private instructionMemory: AddressedInstructionBuffer;
    private readonly delay: number;
    private static readonly INNER_SPACING = 0.01;

    private readTimeout: number = 0;
    private readyToBeRead: boolean = false;
    private requestedAddress: number = -1;

    /**
     * Creates an instance of the InstructionCache.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {number} size The number of lines in the cache.
     * @param {number} width The width of the cache lines.
     * @param delay The fetching delay of the instruction buffer.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, size: number = 4, width: number = 0.9, delay: number = 1) {
        super(parent, xOffset, yOffset);
        this.delay = delay;
        this.cacheLines = [];
        const cacheLineHeight = InstructionCacheLine.dimensions().height;
        const totalHeight = size * cacheLineHeight + (size - 1) * InstructionCache.INNER_SPACING;

        let startYOffset = yOffset - totalHeight / 2 + cacheLineHeight / 2;

        for (let i = 0; i < size; i++) {
            this.cacheLines.push(new InstructionCacheLine(parent,
                xOffset, startYOffset + i * (cacheLineHeight + InstructionCache.INNER_SPACING), width));
        }
    }

    /**
     * Sets the instruction memory to be used by the cache.
     */
    public setInstructionMemory(instructionMemory: AddressedInstructionBuffer): void {
        this.instructionMemory = instructionMemory;
    }

    /**
     * Flushes the cache, clearing all instructions stored in it.
     */
    public flush(): void {
        this.cacheLines.forEach(line => line.clear());
    }

    /**
     * Determines if the cache is ready to be read.
     *
     * @param {number} address The address of the instruction to be read.
     * @returns {boolean} True if the cache is ready to be read, false otherwise.
     */
    public isReadyToBeRead(address: number): boolean {
        if (this.delay == 0)
            throw new Error("No delay instruction buffers are always ready to be read");
        return this.readyToBeRead && this.cacheLineContaining(address) != undefined;
    }

    /**
     * Asks for the instruction at the given address to be fetched.
     *
     * @param {number} address The address of the instruction to be fetched.
     */
    public askForInstructionAt(address: number): [number, MeshBasicMaterial | null] {
        if (this.delay == 0)
            throw new Error("No delay instruction buffers are always ready to be read");
        if (address == this.requestedAddress && this.readTimeout > 0)
            return [-1, null]; // no need to ask for instructions if they are already being fetched

        this.requestedAddress = address;

        if (this.cacheLineContaining(address) != undefined) { // cache hit
            this.readTimeout = this.delay;
        } else if (!this.instructionMemory.isReadyToBeRead()) {
            this.cacheLines.forEach(line => line.clearHighlights());
            return this.instructionMemory.askForInstructionsAt(this.parent, 1, address);
        } else {
            this.cacheLines[0].write(this.instructionMemory.fetchInstructionAt(address)!, address);
            this.cacheLines.push(this.cacheLines.shift()!);
        }
        return [-1, null];
    }

    /**
     * Reads the instruction at the given address from the cache.
     *
     * @param {number} address The address of the instruction to be read.
     * @returns {Instruction} The instruction at the given address.
     */
    public fetchInstructionAt(address: number): Instruction | undefined {
        if (this.delay != 0 && !this.isReadyToBeRead(address))
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);
        const line = this.cacheLineContaining(address);
        if (line == undefined)
            throw new Error(`Address ${address} not found in cache`);

        this.readyToBeRead = false;
        this.cacheLines.forEach(line => line.clearHighlights());
        this.cacheLines.push(this.cacheLines.splice(line, 1)[0]);
        return this.cacheLines[line].read();
    }

    /**
     * Returns the dimensions of the instruction cache.
     *
     * @param {number} size The number of lines in the cache.
     * @returns {{width: number, height: number}} The dimensions of the instruction cache.
     */
    public static dimensions(size: number = 4): { width: number, height: number } {
        const cacheLineDimensions = InstructionCacheLine.dimensions();
        return {
            width: cacheLineDimensions.width,
            height: size * cacheLineDimensions.height + (size - 1) * InstructionCache.INNER_SPACING
        }
    }

    initializeGraphics(): void {
        this.cacheLines.forEach(line => line.initializeGraphics());
        this.width = InstructionCacheLine.dimensions().width;
        this.height = InstructionCache.dimensions(this.cacheLines.length).height;
    }

    update(): void {
        this.cacheLines.forEach(line => line.update());
        if (this.readTimeout > 0) {
            --this.readTimeout;
            if (this.readTimeout <= 0) {
                this.requestedAddress = -1;
                this.readyToBeRead = true;
            }
        }
    }

    /**
     * Returns the index of the cache line containing the given address.
     */
    private cacheLineContaining(address: number): number | undefined {
        for (let i = 0; i < this.cacheLines.length; i++)
            if (this.cacheLines[i].isValid() && this.cacheLines[i].getAddressTag() == address)
                return i;
        return undefined;
    }
}