import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";
import {InstructionBuffer} from "./InstructionBuffer";

export class InstructionMemory extends ComputerChip {
    public static size: number = 16;

    private readonly instructionMemory: Queue<Instruction>;
    private readonly workingMemory: WorkingMemory;
    private needsUpdate: boolean = true;
    private readyToBeRead: boolean = false;
    private readTimeout: number = 0;

    private instructionBuffer = new InstructionBuffer(this, this.scene, {
            x: this.position.x + 1,
            y: this.position.y
        }, 8, true, false);

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene, clockFrequency);
        this.instructionMemory = new Queue<Instruction>(InstructionMemory.size);
        this.workingMemory = workingMemory;
        this.initGraphics();
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
        this.instructionBuffer.initializeGraphics();
    }

    public isReadyToBeRead(): boolean {
        return this.readyToBeRead;
    }

    public askForInstructions(cpu: CPU, n: number): void {
        if (this.readTimeout > 0)
            return;
        this.readyToBeRead = false;

        for (let i = 0; i < n; ++i) {
            if (this.instructionMemory.get(i)) {
                const blinkColor = this.instructionMemory.get(i).isMemoryOperation() ?
                    InstructionMemory.MEMORY_COLOR : InstructionMemory.ALU_COLOR;
                this.highlight(this.bufferMeshName(this.bodyMesh, i), blinkColor);
                this.meshes.get(this.bufferTextMeshName(this.bodyMesh, i)).material = InstructionMemory.COMPONENT_COLOR;
            }
        }
        this.readTimeout = cpu.getClockFrequency() / this.clockFrequency;
    }

    public read(n: number): Queue<Instruction> {
        if (!this.readyToBeRead)
            throw new Error("INSTRUCTION_MEMORY is not ready to be read");
        const instructions = new Queue<Instruction>(n)
        this.moveInstructions(this.instructionMemory, instructions, n)
        this.needsUpdate = true;
        this.readyToBeRead = false;
        this.instructionBuffer.read(1)
        return instructions;
    }

    displayName(): string {
        return "RAM";
    }

    computeMeshProperties(): void {
        this.bodyMesh = "INSTRUCTION_MEMORY";

        const bodyHeight = InstructionMemory.BUFFER_HEIGHT * InstructionMemory.size;
        const bodyWidth = 0.6;

        this.meshProperties.set(this.bodyMesh,
            new MeshProperties(bodyWidth, bodyHeight, 0, 0, InstructionMemory.BODY_COLOR));
        this.drawBuffer(this.bodyMesh, this.meshProperties.get(this.bodyMesh), InstructionMemory.size,
            InstructionMemory.CONTENTS_MARGIN, InstructionMemory.INNER_SPACING, InstructionMemory.COMPONENT_COLOR);

        this.drawPins(this.meshProperties.get(this.bodyMesh), 'left', InstructionMemory.size)
            .forEach((mesh, _name) => this.scene.add(mesh));

        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x, this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.HUD_TEXT_COLOR);
    }

    update() {
        if (this.instructionMemory.isEmpty()) {
            for (let i = 0; i < InstructionMemory.size; i+=8) {
                const typicalWorkload = this.typicalInstructionSequence(8);
                for (let j = 0; j < 8; ++j)
                    this.instructionMemory.enqueue(typicalWorkload.dequeue());
            }
            this.instructionBuffer.write(this.typicalInstructionSequence(8))
        }

        if (this.readTimeout > 0) {
            this.readTimeout--;
            this.readyToBeRead = this.readTimeout <= 0;
        }
        this.instructionBuffer.update();
    }

    drawUpdate(): void {
        if (!this.needsUpdate)
            return;

        this.clearTextMeshes();
        this.addBufferTextMeshes(this.instructionMemory, this.bodyMesh);
        this.textMeshNames.forEach( meshNames => { this.scene.add(this.meshes.get(meshNames)) })
        this.needsUpdate = false;
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