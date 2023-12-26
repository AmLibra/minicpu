import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {MainMemory} from "./MainMemory";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";

export class ROM extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 16;
    private static readonly WIDTH: number = 0.9;
    private static readonly HEIGHT: number = 1.8;
    private static readonly MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.01;

    private readonly instructionMemory: Queue<Instruction>;

    private needsUpdate: boolean = true;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.instructionMemory = new Queue<Instruction>(ROM.MEMORY_SIZE);
    }

    public isEmpty() {
        return this.instructionMemory.isEmpty();
    }

    public read(n: number): Queue<Instruction> {
        if (n > this.instructionMemory.size())
            throw new Error("Cannot read "
                + (n - this.instructionMemory.size() + " more instructions than are available in ROM"));

        const instructions = new Queue<Instruction>(n)
        this.moveInstructions(this.instructionMemory, instructions, n)
        this.needsUpdate = true;
        return instructions;
    }

    computeMeshProperties(): void {
        this.meshProperties.set("ROM",
            new MeshProperties(ROM.WIDTH, ROM.HEIGHT, 0, 0, ROM.COLORS.get("BODY"), true));
        this.drawBuffer(this.meshProperties.get("ROM"), ROM.MEMORY_SIZE,
            ROM.MARGIN, ROM.COMPONENTS_SPACING, ROM.COLORS.get("COMPONENT"));
    }

    update() {
        this.fillInstructionMemoryIfEmpty();
    }

    drawUpdate(): void {
        if (!this.needsUpdate)
            return;
        this.textMeshes.forEach(comp => this.scene.remove(comp));
        this.textMeshes.clear();
        this.drawBufferContents();
        this.textMeshes.forEach(comp => this.scene.add(comp));
        this.needsUpdate = false;
    }

    private drawBufferContents() {
        for (let i = 0; i < this.instructionMemory.size(); ++i) {
            const instruction = this.instructionMemory.get(i);
            if (instruction) {
                const bufferReg = this.meshProperties.get(`BUFFER_${i}`);
                this.textMeshes.set(`BUFFER_${i}`,
                    DrawUtils.buildTextMesh(instruction.toString(),
                        this.position.x,
                        this.position.y - bufferReg.yOffset + bufferReg.height / 2 - ROM.COMPONENTS_SPACING,
                        ROM.TEXT_SIZE,
                        ROM.COLORS.get("TEXT"))
                );
            }
        }
    }

    private fillInstructionMemoryIfEmpty() {
        if (this.instructionMemory.isEmpty()) {
            this.needsUpdate = true;
            for (let i = 0; i < ROM.MEMORY_SIZE; ++i)
                this.instructionMemory.enqueue(this.generateInstruction());
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
        const address = Math.floor(Math.random() * MainMemory.SIZE);
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