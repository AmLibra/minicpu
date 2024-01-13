import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";

export class InstructionMemory extends ComputerChip {
    public static size: number = 8;

    private readonly instructionMemory: Queue<Instruction>;
    private readonly workingMemory: WorkingMemory;
    private needsUpdate: boolean = true;
    private readyToBeRead: boolean = false;
    private readTimeout: number = 0;

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene, clockFrequency);
        this.instructionMemory = new Queue<Instruction>(InstructionMemory.size);
        this.workingMemory = workingMemory;
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
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
        return instructions;
    }

    computeMeshProperties(): void {
        this.bodyMesh = "INSTRUCTION_MEMORY";

        const bodyHeight = InstructionMemory.BUFFER_HEIGHT * InstructionMemory.size;
        const bodyWidth = 0.8;

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
        this.fillInstructionMemoryIfEmpty();
        if (this.readTimeout > 0) {
            this.readTimeout--;
            this.readyToBeRead = this.readTimeout <= 0;
        }
    }

    drawUpdate(): void {
        if (!this.needsUpdate)
            return;

        this.clearMutableTextMeshes();
        this.addBufferTextMeshes(this.instructionMemory, this.bodyMesh);
        this.textMeshNames.forEach( meshNames => { this.scene.add(this.meshes.get(meshNames)) })
        this.needsUpdate = false;
    }

    private fillInstructionMemoryIfEmpty() {
        if (this.instructionMemory.isEmpty()) {
            const instructions = this.typicalInstructionSequence(InstructionMemory.size);
            for (let i = 0; i < InstructionMemory.size; ++i)
                this.instructionMemory.enqueue(instructions.dequeue());
        }
    }

    private typicalInstructionSequence(n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);
        let instructionsLeft = n;
        let modifiedRegisters: number[] = [];

        const minNumberOfLoadOperations = InstructionMemory.size / 4 + 1;
        const maxNumberOfLoadOperations = InstructionMemory.size / 2;
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
        const numberOfALUOperations = 3 + Math.floor(Math.random() * (instructionsLeft - 3 - 1));
        for (let i = 0; i < numberOfALUOperations; ++i) {
            const randomOpcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
            const randomRegisterNumber = this.randomRegisterNumber();
            const result_reg = this.registerName(randomRegisterNumber);
            const op1_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
            const op2_reg = this.registerName(this.randomArrayElement(modifiedRegisters));
            resultRegisters.push(randomRegisterNumber);
            typicalWorkload.enqueue(new Instruction(randomOpcode, result_reg, op1_reg, op2_reg));
        }

        const numberOfStoreOperations = instructionsLeft - numberOfALUOperations;
        for (let i = 0; i < numberOfStoreOperations; ++i) {
            const randomAddress = Math.floor(Math.random() * this.workingMemory.getSize()) % this.workingMemory.getSize();
            const randomResultRegister = this.randomArrayElement(resultRegisters);
            typicalWorkload.enqueue(new Instruction("STORE",
                this.registerName(randomResultRegister),
                undefined, undefined, randomAddress));
            if (resultRegisters.length > 2)
                resultRegisters = resultRegisters.filter(reg => reg !== resultRegisters[randomResultRegister]);
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