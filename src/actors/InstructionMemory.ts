import {Mesh, PlaneGeometry, Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {InstructionBuffer} from "./InstructionBuffer";

export class InstructionMemory extends ComputerChip {
    public readonly size: number;
    private readonly instructionBuffer: InstructionBuffer;
    private readonly instructionStream: Queue<Instruction>;

    private readonly workingMemory: WorkingMemory;

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number, size: number = 16) {
        super(position, scene, clockFrequency);
        this.workingMemory = workingMemory;
        this.size = size;
        this.instructionStream = new Queue<Instruction>(size * 2);
        this.instructionBuffer  = new InstructionBuffer(this, size, 0, 0, false)
        this.initializeGraphics();
    }

    public isReadyToBeRead(): boolean {
        return this.instructionBuffer.isReadyToBeRead();
    }

    public askForInstructions(cpu: CPU, n: number): void {
        this.instructionBuffer.askForInstructions(cpu, n);
    }

    public read(n: number): Queue<Instruction> {
        return this.instructionBuffer.read(n);
    }

    displayName(): string {
        return "RAM";
    }

    update() {
        this.instructionBuffer.update();
        if (this.instructionStream.isEmpty())
            while (this.instructionStream.size() < this.instructionStream.maxSize)
                this.typicalInstructionSequence(8).moveTo(this.instructionStream);

        if (Math.random() < 0.6)
            this.instructionBuffer.write(this.instructionStream, 1);
    }

    computeMeshProperties(): void {
    }

    drawUpdate(): void {
    }

    private initializeGraphics(): void {
        const bodyHeight = this.instructionBuffer.height + InstructionMemory.CONTENTS_MARGIN * 2;
        const bodyWidth = this.instructionBuffer.width + InstructionMemory.CONTENTS_MARGIN * 2;
        this.bodyMesh = new Mesh(new PlaneGeometry(bodyWidth, bodyHeight), InstructionMemory.BODY_COLOR);
        this.bodyMesh.position.set(this.position.x, this.position.y, 0);

        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x, this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.HUD_TEXT_COLOR);
        this.clockMesh.visible = false;

        this.drawPins(this.bodyMesh, 'left', this.size).forEach((mesh, _name) => this.scene.add(mesh));

        this.scene.add(this.bodyMesh, this.clockMesh);
        this.buildSelectedMesh();
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
            const randomOpcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
            const randomRegisterNumber = this.randomRegisterNumber();
            const result_reg = this.registerName(randomRegisterNumber);
            const op1_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
            const op2_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
            if (!resultRegisters.includes(randomRegisterNumber)) resultRegisters.push(randomRegisterNumber);
            typicalWorkload.enqueue(new Instruction(randomOpcode, result_reg, op1_reg, op2_reg));
        }
        instructionsLeft -= numberOfALUOperations;

        for (let i = 0; i < instructionsLeft; ++i) {
            const randomAddress = Math.floor(Math.random() * this.workingMemory.getSize()) % this.workingMemory.getSize();
            const randomResultRegister = this.randomArrayElement(resultRegisters);
            typicalWorkload.enqueue(new Instruction("STORE", this.registerName(randomResultRegister),
                undefined, undefined, randomAddress));
            if (resultRegisters.length > 1)
                resultRegisters.splice(resultRegisters.indexOf(randomResultRegister), 1);
        }

        return typicalWorkload;
    }

    private randomArrayElement<T>(array: Array<T>): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private randomRegisterNumber(): number {
        return Math.floor(Math.random() * (CPU.REGISTER_SIZE - 1));
    }

    private randomConsecutiveRegisterNumbers(n: number): number[] {
        const randomRegisterNumber = this.randomRegisterNumber();
        const randomRegisterNumbers: number[] = [];
        for (let i = 0; i < n; ++i)
            randomRegisterNumbers.push((randomRegisterNumber + i) % CPU.REGISTER_SIZE);
        return randomRegisterNumbers;
    }

    private randomConsecutiveAddresses(n: number): number[] {
        const randomAddress = Math.floor(Math.random() * this.workingMemory.getSize());
        const randomAddresses: number[] = [];
        for (let i = 0; i < n; ++i)
            randomAddresses.push((randomAddress + i) % this.workingMemory.getSize());
        return randomAddresses;
    }
}