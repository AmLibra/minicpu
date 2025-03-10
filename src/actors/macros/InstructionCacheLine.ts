import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {Instruction} from "../../dataStructures/Instruction";
import {ComputerChip} from "../ComputerChip";
import {Counter} from "./primitives/Counter";
import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {Queue} from "../../dataStructures/Queue";

/**
 * Represents a line in the instruction cache of a computer chip.
 */
export class InstructionCacheLine extends ComputerChipMacro {
    private static readonly WIDTH = 0.9;
    private static readonly SPACING = 0.01;
    private valid: boolean = false;
    private addressTag: Counter;
    private instructionBuffer: InstructionBuffer;

    /**
     * Creates an instance of the InstructionCacheLine.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {number} width The width of the instruction cache line.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, width: number = InstructionCacheLine.WIDTH) {
        super(parent, xOffset, yOffset);
        this.height = InstructionBuffer.BUFFER_HEIGHT;
        this.width = width;
        this.addressTag = new Counter(parent, xOffset - this.width / 2 + Counter.dimensions().width / 2, yOffset);
        const bufferWidth = this.width - Counter.dimensions().width - InstructionCacheLine.SPACING;
        this.instructionBuffer = new InstructionBuffer(parent, 1,
            xOffset + this.width / 2 - bufferWidth / 2, yOffset, 0, false,
            false, bufferWidth);
    }

    /**
     * Returns the dimensions of the instruction cache line.
     *
     * @returns {{width: number, height: number}} The width and height of the instruction cache line.
     */
    public static dimensions(): { width: number, height: number } {
        return {width: InstructionCacheLine.WIDTH, height: InstructionBuffer.BUFFER_HEIGHT};
    }

    /**
     * Clears the instruction stored in the cache line.
     */
    public clear(): void {
        this.valid = false;
        this.addressTag.set(0);
        this.instructionBuffer.clear();
    }

    /**
     * Determines if the cache line is valid.
     *
     * @returns {boolean} True if the cache line is valid, false otherwise.
     */
    public isValid(): boolean {
        return this.valid;
    }

    /**
     * Returns the address tag of the cache line.
     *
     * @returns {number} The address tag of the cache line.
     */
    public getAddressTag(): number {
        return this.addressTag.get();
    }

    /**
     * Reads the instruction from the cache line.
     *
     * @returns {Instruction} The instruction read from the cache line.
     */
    public read(): Instruction | undefined {
        if (!this.valid)
            throw new Error("Invalid cache line read");
        return this.instructionBuffer.peek();
    }

    /**
     * Writes an instruction to the cache line.
     *
     * @param {Instruction} instruction The instruction to be written.
     * @param {number} address The address of the instruction.
     */
    public write(instruction: Instruction, address: number): void {
        this.valid = true;
        this.addressTag.set(address);
        this.instructionBuffer.clear();
        this.instructionBuffer.write(Queue.of(instruction));
        this.instructionBuffer.peek(); // hacky way to highlight the instruction
    }

    /**
     * Invalidates the cache line.
     */
    public invalidate(): void {
        this.valid = false;
    }

    public clearHighlights(): void {
        this.addressTag.clearHighlights();
        this.instructionBuffer.clearHighlights();
    }

    initializeGraphics(): void {
        this.addressTag.initializeGraphics();
        this.instructionBuffer.initializeGraphics();
    }

    update(): void {
        this.addressTag.update(true);
    }
}