import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";

export class ROM extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 12;
    private readonly instruction_memory: Instruction[];

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.instruction_memory = new Array(ROM.MEMORY_SIZE)
    }

    public update() {
        if (this.getFixedArrayLength(this.instruction_memory) == 0) {
            for (let i = 0; i < ROM.MEMORY_SIZE; ++i) {
                this.instruction_memory[i] = this.generateInstruction();
            }
        }
        this.drawUpdate();
    }

    public draw(): void {
        this.drawComponent("ROM", this.position.x, this.position.y, 0.8, 1.5, "BODY");
        this.graphicComponents.forEach(comp => this.scene.add(comp));
    }

    // TODO: Make this a static method in a utility class
    private drawComponent(name: string, xOffset: number, yOffset: number, width: number, height: number, colorKey: string): void {
        const component = DrawUtils.drawQuadrilateral(width, height, ROM.COLORS.get(colorKey));
        component.position.set(this.position.x + xOffset, this.position.y + yOffset, 0);
        this.graphicComponents.set(name, component);
    }

    private drawUpdate(): void {
        this.textComponents.forEach(comp => this.scene.remove(comp));
        this.textComponents.clear();
        for (let i = 0; i < this.instruction_memory.length; ++i) {
            const instruction = this.instruction_memory[i];
            if (instruction) {
                const text = instruction.toString();
                const xOffset = this.position.x + 0.6;
                const yOffset = this.position.y + 0.6 - (i * 0.1);
                const size = 0.05;
                const color = ROM.COLORS.get("TEXT");
                const text_graphic = DrawUtils.drawText(text, xOffset, yOffset, size, color);
                this.textComponents.set(`ROM_TEXT_${i}`, text_graphic);
            }
        }
        this.textComponents.forEach(comp => this.scene.add(comp));
    }

    public read(n: number): Instruction[] {
        if (n > this.getFixedArrayLength(this.instruction_memory))
            throw new Error("Cannot read " + (n - this.getFixedArrayLength(this.instruction_memory)) + " more instructions than are available in ROM")

        const instructions = new Array(n);
        for (let i = 0; i < n; ++i) {
            instructions[i] = this.instruction_memory.shift()
            this.instruction_memory.push(null)
        }
        return instructions;
    }

    public generateInstruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op1_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op2_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}