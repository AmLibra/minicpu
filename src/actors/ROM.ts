import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {MainMemory} from "./MainMemory";
import {ComponentGraphicProperties} from "../components/ComponentGraphicProperties";
import {Queue} from "../components/Queue";

export class ROM extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 16;
    private static readonly WIDTH: number = 0.9;
    private static readonly HEIGHT: number = 1.8;
    private static readonly MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.01;

    private readonly instructionMemory: Queue<Instruction>;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.computeGraphicComponentProperties();
        this.instructionMemory = new Queue<Instruction>(ROM.MEMORY_SIZE);
    }

    private computeGraphicComponentProperties(): void {
        this.graphicComponentProperties.set("ROM",
            new ComponentGraphicProperties(ROM.WIDTH, ROM.HEIGHT, 0, 0, ROM.COLORS.get("BODY")));
        this.drawBuffer(this.graphicComponentProperties.get("ROM"), ROM.MEMORY_SIZE,
            ROM.MARGIN, ROM.COMPONENTS_SPACING, ROM.COLORS.get("COMPONENT"));
    }

    public isEmpty() {
        return this.instructionMemory.isEmpty();
    }

    public update() {
        if (this.instructionMemory.isEmpty())
            for (let i = 0; i < ROM.MEMORY_SIZE; ++i)
                this.instructionMemory.enqueue(this.generateInstruction());
        this.drawUpdate();
    }

    public initializeGraphics(): void {
        this.graphicComponentProperties.forEach((value, key) => {
            this.drawSimpleGraphicComponent(key)
            this.scene.add(this.graphicComponents.get(key));
        });
    }

    private drawUpdate(): void {
        this.textComponents.forEach(comp => this.scene.remove(comp));
        this.textComponents.clear();

        for (let i = 0; i < this.instructionMemory.size(); ++i) {
            const instruction = this.instructionMemory.get(i);
            if (instruction) {
                const bufferReg = this.graphicComponentProperties.get(`BUFFER_${i}`);
                this.textComponents.set(`BUFFER_${i}`,
                    DrawUtils.drawText(instruction.toString(),
                        this.position.x,
                        this.position.y - bufferReg.yOffset + bufferReg.height / 2 - ROM.COMPONENTS_SPACING,
                        ROM.TEXT_SIZE,
                        ROM.COLORS.get("TEXT")));
            }
        }
        this.textComponents.forEach(comp => this.scene.add(comp));
    }

    public read(n: number): Queue<Instruction> {
        if (n > this.instructionMemory.size())
            throw new Error("Cannot read " + (n - this.instructionMemory.size() + " more instructions than are available in ROM"));

        const instructions = new Queue<Instruction>(n)
        this.moveInstructions(this.instructionMemory, instructions, n)
        return instructions;
    }

    public generateInstruction(): Instruction {
        // 50% chance of generating an ALU instruction
        if (Math.random() < 0.5)
            return this.generateALUInstruction();
        else
            return this.generateMemoryInstruction();
    }

    public generateMemoryInstruction(): Instruction {
        const opcode = CPU.MEMORY_OPCODES[Math.floor(Math.random() * CPU.MEMORY_OPCODES.length)];
        const result_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const address = Math.floor(Math.random() * MainMemory.SIZE);
        return new Instruction(opcode, result_reg, undefined, undefined, address);
    }

    public generateALUInstruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const op1_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        const op2_reg = CPU.REGISTER_NAMES[Math.floor(Math.random() * CPU.REGISTER_NAMES.length)];
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}