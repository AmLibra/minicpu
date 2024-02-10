import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {AddressedInstructionBuffer} from "./AddressedInstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {AddressCounter} from "./primitives/AddressCounter";
import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {Instruction} from "../../components/Instruction";
import {Queue} from "../../components/Queue";
import {Decoder} from "./Decoder";

/**
 * Represents the instruction fetcher of a computer chip, handling the fetching of instructions.
 */
export class InstructionFetcher extends ComputerChipMacro {
    private static readonly WIDTH = 0.9;
    private static readonly SPACING = 0.01;
    private readonly instructionMemory: AddressedInstructionBuffer;

    private readonly programCounter: AddressCounter;
    private readonly instructionBuffer: InstructionBuffer;
    private fetchingAddress: number = -1;

    /**
     * Creates an instance of the InstructionFetcher.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {AddressedInstructionBuffer} instructionMemory The instruction memory associated with the instruction
     *     fetcher.
     * @param {number} width The width of the instruction fetcher.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, instructionMemory: AddressedInstructionBuffer, width: number = InstructionFetcher.WIDTH) {
        super(parent, xOffset, yOffset);
        this.instructionMemory = instructionMemory;
        this.height = InstructionBuffer.BUFFER_HEIGHT;
        this.width = width;
        this.programCounter = new AddressCounter(parent, xOffset - this.width / 2 + AddressCounter.dimensions().width / 2, yOffset);
        const bufferWidth = this.width - AddressCounter.dimensions().width - InstructionFetcher.SPACING;
        this.instructionBuffer = new InstructionBuffer(parent, 1,
            xOffset + this.width / 2 - bufferWidth / 2, yOffset, 0, false,
            false, bufferWidth)
    }

    /**
     * Reads the next instruction from the instruction buffer.
     *
     * @returns {Instruction} The next instruction to be executed.
     */
    public read(): Instruction {
        const instruction = this.instructionBuffer.read(1);
        return instruction ? instruction.dequeue() : null;
    }

    /**
     * Sets the program counter to a new value.
     *
     * @param {number} n The new value of the program counter.
     */
    public setProgramCounter(n: number): void {
        this.programCounter.set(n);
        if (this.fetchingAddress != n) // clear the fetch buffer if the fetch address is different from the new PC
            this.instructionBuffer.read(1);
    }

    /**
     * Notifies the instruction fetcher that a branch was skipped.
     */
    public notifyBranchSkipped(): void {
        this.instructionMemory.clearJumpInstruction();
    }

    /**
     * Fetches the next instruction from the instruction memory.
     */
    public next(): void {
        if (this.instructionBuffer.isFull())
            return;

        if (!this.instructionMemory.isReadyToBeRead()) {
            this.fetchingAddress = this.programCounter.get();
            this.instructionMemory.askForInstructionsAt(this.parent, 1, this.programCounter.get());
            return;
        }
        const instruction = this.instructionMemory.fetchInstructionAt(this.programCounter.get());
        if (!instruction)
            return;
        const queue = new Queue<Instruction>(1);
        queue.enqueue(instruction)
        this.instructionBuffer.write(queue, 1);
        this.programCounter.update();
    }


    initializeGraphics(): void {
        this.instructionBuffer.initializeGraphics();
        this.programCounter.initializeGraphics();
    }

    update(): void {
        throw new Error("Instruction fetcher should not be updated manually");
    }
}