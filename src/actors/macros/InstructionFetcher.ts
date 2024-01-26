import {ComputerChipMacro} from "./ComputerChipMacro";
import {AddressedInstructionBuffer} from "./AddressedInstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {Counter} from "./Counter";
import {InstructionBuffer} from "./InstructionBuffer";
import {Instruction} from "../../components/Instruction";
import {Queue} from "../../components/Queue";

export class InstructionFetcher extends ComputerChipMacro {
    private static readonly SPACING = 0.01;
    private readonly instructionMemory: AddressedInstructionBuffer;

    private readonly programCounter: Counter;
    private readonly instructionBuffer: InstructionBuffer;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, instructionMemory: AddressedInstructionBuffer, width: number = 0.9) {
        super(parent, xOffset, yOffset);
        this.instructionMemory = instructionMemory;
        this.width = width;
        this.programCounter = new Counter(parent, xOffset, yOffset);
        this.programCounter.dispose();
        this.programCounter = new Counter(parent, xOffset - this.width / 2 + this.programCounter.width / 2, yOffset);
        const bufferWidth = this.width - this.programCounter.width - InstructionFetcher.SPACING;
        this.instructionBuffer = new InstructionBuffer(parent, 1,
            xOffset + this.width / 2 - bufferWidth / 2, yOffset, true, false,
            false, bufferWidth)
    }

    public read(): Queue<Instruction> {
        return this.instructionBuffer.read(1);
    }

    public setProgramCounter(n: number): void {
        this.programCounter.set(n);
    }

    public notifyBranchSkipped(): void {
        this.instructionMemory.clearJumpInstruction(this.programCounter.get() - 1);
    }

    public fetchInstruction(): void {
        if (!this.instructionMemory.isReadyToBeRead()) {
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

    public update(): void {
        throw new Error("Instruction fetcher should not be updated manually");
    }

    public initializeGraphics(): void {
        this.instructionBuffer.initializeGraphics();
        this.programCounter.initializeGraphics();
    }
}