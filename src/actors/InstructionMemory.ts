import {Material, Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";

export class InstructionMemory extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 6;
    private static readonly WIDTH: number = 0.8;
    private static readonly BUFFER_HEIGHT: number = 0.12;
    private static readonly HEIGHT: number = this.BUFFER_HEIGHT * InstructionMemory.MEMORY_SIZE;
    private static readonly MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.01;

    private readonly instructionMemory: Queue<Instruction>;

    private needsUpdate: boolean = true;
    public readyToBeRead: boolean = false;
    private readTimeout: number = 0;
    private FETCH_INSTRUCTION_DELAY: number = 2;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.instructionMemory = new Queue<Instruction>(InstructionMemory.MEMORY_SIZE);
    }

    public askForInstructions(): void {
        if (this.readTimeout > 0)
            return;
        this.readyToBeRead = false;
        this.readTimeout = this.FETCH_INSTRUCTION_DELAY;
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
        this.meshProperties.set("INSTRUCTION_MEMORY",
            new MeshProperties(InstructionMemory.WIDTH, InstructionMemory.HEIGHT, 0, 0, InstructionMemory.COLORS.get("BODY")));
        this.drawBuffer("", this.meshProperties.get("INSTRUCTION_MEMORY"), InstructionMemory.MEMORY_SIZE,
            InstructionMemory.MARGIN, InstructionMemory.COMPONENTS_SPACING, InstructionMemory.COLORS.get("COMPONENT"));
        this.drawPins(this.meshProperties.get("INSTRUCTION_MEMORY"), 'left', InstructionMemory.MEMORY_SIZE).forEach((mesh, _name) => this.scene.add(mesh));
    }

    update() {
        this.fillInstructionMemoryIfEmpty();
        if (this.readTimeout > 0) {
            this.readTimeout--;
            if (this.readTimeout === 0){
                this.readyToBeRead = true;
            }
        }
    }

    drawUpdate(): void {
        if (!this.needsUpdate)
            return;

        this.clearMutableTextMeshes();
        this.addBufferTextMeshes(this.instructionMemory, "");
        this.textMeshes.forEach(comp => this.scene.add(comp));
        this.needsUpdate = false;
    }

    private fillInstructionMemoryIfEmpty() {
        if (this.instructionMemory.isEmpty()) {
            for (let i = 0; i < InstructionMemory.MEMORY_SIZE; ++i)
                this.instructionMemory.enqueue(this.generateInstruction());
            this.needsUpdate = true;
        }
    }

    private generateInstruction(): Instruction {
        if (Math.random() < 0.5)
            return this.generateALUInstruction();
        else
            return this.generateMemoryInstruction();
    }

    private generateMemoryInstruction(): Instruction {
        const opcode = CPU.MEMORY_OPCODES[Math.floor(Math.random() * CPU.MEMORY_OPCODES.length)];
        const result_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const address = Math.floor(Math.random() * WorkingMemory.SIZE);
        return new Instruction(opcode, result_reg, undefined, undefined, address);
    }

    private generateALUInstruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const op1_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const op2_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}