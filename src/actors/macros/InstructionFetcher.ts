import {ComputerChipMacro} from "./ComputerChipMacro";
import {AddressedInstructionBuffer} from "./AddressedInstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {Counter} from "./Counter";
import {InstructionBuffer} from "./InstructionBuffer";

export class InstructionFetcher extends ComputerChipMacro {
    public update(): void {
        throw new Error("Method not implemented.");
    }
    public initializeGraphics(): void {
        throw new Error("Method not implemented.");
    }
    private readonly instructionBuffer: AddressedInstructionBuffer;
    private readonly programCounter: Counter;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, instructionBuffer: AddressedInstructionBuffer) {
        super(parent, xOffset, yOffset);
        this.instructionBuffer = instructionBuffer;
        this.programCounter = new Counter(parent, 0, 0);
    }

    public fetchInstruction(): void {
        if (!this.instructionBuffer.isReadyToBeRead())
            this.instructionBuffer.askForInstructions(this.parent, 1);
        const instruction = this.instructionBuffer.fetchInstructionAt(this.programCounter.get());
        if (!instruction)
            return;
        this.programCounter.update();
    }
}