import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {SISDProcessor} from "./SISDProcessor";
import {ComputerChip, Side} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {AddressedInstructionBuffer} from "./macros/AddressedInstructionBuffer";

export class InstructionMemory extends ComputerChip {
    public static readonly ADDRESS_MARGIN: number = 0.2;

    public readonly size: number;
    private readonly instructionBuffer: AddressedInstructionBuffer;
    private readonly instructionStream: Queue<Instruction>;
    private readonly workingMemory: WorkingMemory;

    private forLoopProbability: number = 0.3;

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number, size: number = 16) {
        super(position, scene, clockFrequency);
        this.workingMemory = workingMemory;
        this.size = size;
        this.instructionStream = new Queue<Instruction>();
        this.instructionBuffer = new AddressedInstructionBuffer(this, size,
            InstructionMemory.ADDRESS_MARGIN * 0.6 + InstructionMemory.INNER_SPACING - InstructionMemory.CONTENTS_MARGIN,
            0, false)
        this.initializeGraphics();
    }

    public getInstructionBuffer(): AddressedInstructionBuffer {
        return this.instructionBuffer;
    }

    displayName(): string {
        return "Instruction Memory";
    }

    update() {
        this.instructionBuffer.update();
        this.updateInstructionStream();

        if (Math.random() < 0.4)
            this.instructionBuffer.write(this.instructionStream, 1);
    }

    private updateInstructionStream() {
        if (!this.instructionStream.isEmpty())
            return;
        let addedInstructions = 0;
        while (this.instructionStream.size() < this.size * 2) {
            if (Math.random() < this.forLoopProbability) {
                const minInstructions = 2;
                const maxInstructions = 6;
                const n = minInstructions + Math.floor(Math.random() * (maxInstructions - minInstructions));
                this.typicalForLoop(addedInstructions, n).moveTo(this.instructionStream);
                addedInstructions += n;
            } else {
                const minInstructions = 4;
                const maxInstructions = 8;
                const n = minInstructions + Math.floor(Math.random() * (maxInstructions - minInstructions));
                this.typicalInstructionSequence(n).moveTo(this.instructionStream);
                addedInstructions += n;
            }
        }
    }

    private initializeGraphics(): void {
        const bodyHeight = this.instructionBuffer.height + InstructionMemory.CONTENTS_MARGIN * 2;
        const bodyWidth = this.instructionBuffer.width + InstructionMemory.CONTENTS_MARGIN * 2
            + InstructionMemory.ADDRESS_MARGIN;
        this.buildBodyMesh(bodyWidth, bodyHeight);

        this.drawPins(this.bodyMesh, Side.LEFT, this.size);
        this.instructionBuffer.initializeGraphics();
    }

    private typicalInstructionSequence(n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);
        let instructionsLeft = n;
        let loadedRegisters: number[] = [];

        const minNumberOfLoadOperations = Math.floor(n * 0.3); // min 30% of the instructions are load operations
        const maxNumberOfLoadOperations = n / 2; // max 50% of the instructions are load operations
        const numberOfLoadOperations = minNumberOfLoadOperations + Math.floor(Math.random() * maxNumberOfLoadOperations);

        const randomRegisterNumbers = this.randomConsecutiveRegisterNumbers(numberOfLoadOperations);
        const randomAddresses = this.randomConsecutiveAddresses(numberOfLoadOperations);
        for (let i = 0; i < numberOfLoadOperations; ++i) {
            loadedRegisters.push(randomRegisterNumbers[i]);
            typicalWorkload.enqueue(new Instruction("LOAD", this.registerName(randomRegisterNumbers[i]),
                undefined, undefined, randomAddresses[i]));
        }
        instructionsLeft -= numberOfLoadOperations;

        let resultRegisters: number[] = [];
        const minNumberOfALUOperations = Math.floor(n * 0.4); // min 40% of the instructions are ALU operations
        const numberOfALUOperations = minNumberOfALUOperations + Math.floor(Math.random() * (instructionsLeft - 2));
        for (let i = 0; i < numberOfALUOperations; ++i) {
            const randomOpcode = SISDProcessor.ALU_OPCODES[Math.floor(Math.random() * SISDProcessor.ALU_OPCODES.length)];
            const randomRegisterNumber = this.randomRegisterNumber();
            const result_reg = this.registerName(randomRegisterNumber);
            const op1_reg = this.registerName(this.randomArrayElement(loadedRegisters));
            const op2_reg = this.registerName(this.randomArrayElement(loadedRegisters));
            if (!resultRegisters.includes(randomRegisterNumber)) resultRegisters.push(randomRegisterNumber);
            typicalWorkload.enqueue(new Instruction(randomOpcode, result_reg, op1_reg, op2_reg));
        }
        instructionsLeft -= numberOfALUOperations;

        for (let i = 0; i < instructionsLeft; ++i) {
            const randomAddress = Math.floor(Math.random() * this.workingMemory.size);
            const randomResultRegister = this.randomArrayElement(resultRegisters);
            typicalWorkload.enqueue(new Instruction("STORE", this.registerName(randomResultRegister),
                undefined, undefined, randomAddress));
            if (resultRegisters.length > 1)
                resultRegisters.splice(resultRegisters.indexOf(randomResultRegister), 1);
        }

        return typicalWorkload;
    }

    private typicalForLoop(nPreviouslyAddedInstructions: number, n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);

        const it = this.randomRegisterNumber();
        const comparedTo = this.randomRegisterNumber();

        const numberOfALUOperations = n - 1;
        for (let i = 0; i < numberOfALUOperations; ++i) {
            const randomOpcode = SISDProcessor.ALU_OPCODES[Math.floor(Math.random() * SISDProcessor.ALU_OPCODES.length)];
            const result_reg = this.registerName(it);
            const op1_reg = this.registerName(it);
            const op2_reg = this.registerName(comparedTo);
            typicalWorkload.enqueue(new Instruction(randomOpcode, result_reg, op1_reg, op2_reg));
        }

        const branchOp = SISDProcessor.BRANCH_OPCODES[Math.floor(Math.random() * SISDProcessor.BRANCH_OPCODES.length)];
        const branchTarget = this.instructionBuffer.highestInstructionAddress() + nPreviouslyAddedInstructions
        typicalWorkload.enqueue(new Instruction(branchOp, undefined,
            this.registerName(it), this.registerName(comparedTo), branchTarget));
        this.instructionBuffer.setJumpAddress(branchTarget, branchTarget + n);

        return typicalWorkload;
    }

    private randomArrayElement<T>(array: Array<T>): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private randomRegisterNumber(): number {
        return Math.floor(Math.random() * (SISDProcessor.REGISTER_SIZE - 1));
    }

    private randomConsecutiveRegisterNumbers(n: number): number[] {
        const randomRegisterNumber = this.randomRegisterNumber();
        const randomRegisterNumbers: number[] = [];
        for (let i = 0; i < n; ++i)
            randomRegisterNumbers.push((randomRegisterNumber + i) % SISDProcessor.REGISTER_SIZE);
        return randomRegisterNumbers;
    }

    private randomConsecutiveAddresses(n: number): number[] {
        const randomAddress = Math.floor(Math.random() * this.workingMemory.size);
        const randomAddresses: number[] = [];
        for (let i = 0; i < n; ++i)
            randomAddresses.push((randomAddress + i) % this.workingMemory.size);
        return randomAddresses;
    }

    private registerName(registerNumber: number): string {
        return `R${registerNumber}`;
    }
}