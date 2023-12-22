import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {MainMemory} from "./MainMemory";

export class ROM extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 16;
    private static readonly WIDTH: number = 0.9;
    private static readonly HEIGHT: number = 1.8;
    private static readonly MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.01;

    private readonly instruction_memory: Instruction[];

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.computeGraphicComponentProperties();
        this.instruction_memory = new Array(ROM.MEMORY_SIZE)
    }

    private computeGraphicComponentProperties(): void {
        this.graphicComponentProperties.set("ROM", {
            width: ROM.WIDTH,
            height: ROM.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: ROM.COLORS.get("BODY")
        });

        this.drawBuffer(this.graphicComponentProperties.get("ROM"), ROM.MEMORY_SIZE,
            ROM.MARGIN, ROM.COMPONENTS_SPACING, ROM.COLORS.get("COMPONENT"));
    }

    public isEmpty() {
        return this.getFixedArrayLength(this.instruction_memory) == 0;
    }

    public update() {
        if (this.getFixedArrayLength(this.instruction_memory) == 0)
            for (let i = 0; i < ROM.MEMORY_SIZE; ++i)
                this.instruction_memory[i] = this.generateInstruction();
        this.drawUpdate();
    }

    public draw(): void {
        this.graphicComponentProperties.forEach((value, key) => {
            this.drawSimpleGraphicComponent(key)
            this.scene.add(this.graphicComponents.get(key));
        });
    }

    private drawUpdate(): void {
        this.textComponents.forEach(comp => this.scene.remove(comp));
        this.textComponents.clear();

        for (let i = 0; i < this.instruction_memory.length; ++i) {
            const instruction = this.instruction_memory[i];
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

    public read(n: number): Instruction[] {
        if (n > this.getFixedArrayLength(this.instruction_memory))
            throw new Error("Cannot read " + (n - this.getFixedArrayLength(this.instruction_memory)) + " more instructions than are available in ROM")

        const instructions = new Array(n);
        this.moveInstructions(this.instruction_memory, instructions, n)
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