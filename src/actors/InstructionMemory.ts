import {Mesh, PlaneGeometry, Scene} from "three";
import {Instruction} from "../components/Instruction";
import {SISDProcessor} from "./SISDProcessor";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {InstructionBuffer} from "./macros/InstructionBuffer";
import {AddressedInstructionBuffer} from "./macros/AddressedInstructionBuffer";
import {floor} from "three/examples/jsm/nodes/shadernode/ShaderNodeBaseElements";

export class InstructionMemory extends ComputerChip {
    public readonly size: number;
    private readonly instructionBuffer: AddressedInstructionBuffer;
    private readonly instructionStream: Queue<Instruction>;

    private readonly workingMemory: WorkingMemory;
    public static readonly ADDRESS_MARGIN: number = 0.2;

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number, size: number = 16) {
        super(position, scene, clockFrequency);
        this.workingMemory = workingMemory;
        this.size = size;
        this.instructionStream = new Queue<Instruction>(size * 2);
        this.instructionBuffer  = new AddressedInstructionBuffer(this, size,
            InstructionMemory.ADDRESS_MARGIN * 0.6 + InstructionMemory.INNER_SPACING - InstructionMemory.CONTENTS_MARGIN, 0, false)
        this.initializeGraphics();
    }

    public getInstructionBuffer(): AddressedInstructionBuffer {
        return this.instructionBuffer;
    }

    displayName(): string {
        return "InstructionMemory";
    }

    update() {
        this.instructionBuffer.update();
        if (this.instructionStream.isEmpty()) {
            let hasLoop = false;
            let n = 0;
            while (this.instructionStream.size() < this.instructionStream.maxSize) {
                if (Math.random() < 0.6) {
                    this.typicalForLoop(n, 4).moveTo(this.instructionStream);
                    hasLoop = true;
                    n += 4;
                }
                else {
                    this.typicalInstructionSequence(8).moveTo(this.instructionStream);
                    n += 8;
                }
            }
        }

        if (Math.random() < 0.2)
            this.instructionBuffer.write(this.instructionStream, 1);
    }

    private initializeGraphics(): void {
        const bodyHeight = this.instructionBuffer.height + InstructionMemory.CONTENTS_MARGIN * 2;
        const bodyWidth = this.instructionBuffer.width + InstructionMemory.CONTENTS_MARGIN * 2 + InstructionMemory.ADDRESS_MARGIN;
        this.buildBodyMesh(bodyWidth, bodyHeight);

        this.drawPins(this.bodyMesh, 'left', this.size).forEach((mesh, _name) => this.scene.add(mesh));
        this.instructionBuffer.initializeGraphics();
    }

    private typicalInstructionSequence(n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);
        let instructionsLeft = n;
        let modifiedRegisters: number[] = [];

        const minNumberOfLoadOperations = n / 4 + 1;
        const maxNumberOfLoadOperations = n / 2;
        const numberOfLoadOperations = minNumberOfLoadOperations
            + Math.floor(Math.random() * (maxNumberOfLoadOperations - minNumberOfLoadOperations));
        const randomRegisterNumbers = this.randomConsecutiveRegisterNumbers(numberOfLoadOperations);
        const randomAddresses = this.randomConsecutiveAddresses(numberOfLoadOperations);
        for (let i = 0; i < numberOfLoadOperations; ++i) {
            modifiedRegisters.push(randomRegisterNumbers[i]);
            typicalWorkload.enqueue(new Instruction("LOAD", this.registerName(randomRegisterNumbers[i]),
                undefined, undefined, randomAddresses[i]));
        }
        instructionsLeft -= numberOfLoadOperations;

        let resultRegisters: number[] = [];
        const minNumberOfALUOperations = 3;
        const numberOfALUOperations = minNumberOfALUOperations
            + Math.floor(Math.random() * (instructionsLeft - minNumberOfALUOperations - 2));
        for (let i = 0; i < numberOfALUOperations; ++i) {
            const randomOpcode = SISDProcessor.ALU_OPCODES[Math.floor(Math.random() * SISDProcessor.ALU_OPCODES.length)];
            const randomRegisterNumber = this.randomRegisterNumber();
            const result_reg = this.registerName(randomRegisterNumber);
            const op1_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
            const op2_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
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


    private typicalForLoop(nPreviouslyAddedInstructions:number, n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);

        const it = this.randomRegisterNumber();
        const comparedTo = this.randomRegisterNumber();

        const numberOfALUOperations =  n - 1;
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
        this.instructionBuffer.setPotentialJumpAddress(branchTarget);

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
}