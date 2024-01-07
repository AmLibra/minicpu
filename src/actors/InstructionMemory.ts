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

    // Mesh names
    private bodyMesh: string;

    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene);
        this.instructionMemory = new Queue<Instruction>(InstructionMemory.size);
        this.workingMemory = workingMemory;
        this.clockFrequency = clockFrequency;
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
                this.blink(this.bufferMeshName(this.bodyMesh, i), blinkColor);
                this.textMeshes.get(this.bufferMeshName(this.bodyMesh, i)).material = InstructionMemory.COMPONENT_COLOR;
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
        this.textMeshes.forEach(comp => this.scene.add(comp));
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
        const typicalWorkload = new Queue<Instruction>(6);

        // usually start with 2 memory operations to load 2 operands, then 1 ALU operation to compute the result
        typicalWorkload.enqueue(this.generateMemoryInstruction());
        typicalWorkload.enqueue(this.generateMemoryInstruction());
        typicalWorkload.enqueue(this.generateALUInstruction());
        typicalWorkload.enqueue(this.generateALUInstruction());
        typicalWorkload.enqueue(this.generateMemoryInstruction());
        typicalWorkload.enqueue(this.generateALUInstruction());
        const instructions = new Queue<Instruction>(n);
        for (let i = 0; i < n; ++i)
            instructions.enqueue(typicalWorkload.get(i % 6));

        return instructions;
    }

    private generateMemoryInstruction(): Instruction {
        const opcode = CPU.MEMORY_OPCODES[Math.floor(Math.random() * CPU.MEMORY_OPCODES.length)];
        const result_reg = this.registerName(Math.floor(Math.random() * CPU.REGISTER_SIZE));
        const address = Math.floor(Math.random() * this.workingMemory.getSize());
        return new Instruction(opcode, result_reg, undefined, undefined, address);
    }

    private generateALUInstruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = this.registerName(Math.floor(Math.random() * CPU.REGISTER_SIZE));
        const op1_reg = this.registerName(Math.floor(Math.random() * CPU.REGISTER_SIZE));
        const op2_reg = this.registerName(Math.floor(Math.random() * CPU.REGISTER_SIZE));
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}