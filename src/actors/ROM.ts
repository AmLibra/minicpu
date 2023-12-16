import {Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";

export class ROM extends ComputerChip {

    public static readonly MEMORY_SIZE: number = 16;
    private static readonly WIDTH: number = 0.9;
    private static readonly HEIGHT: number = 1.8;
    private static readonly COMPONENTS_INNER_MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.02;

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

        for (let i = 0; i < ROM.MEMORY_SIZE; ++i) {
            const totalAvailableHeight = ROM.HEIGHT - (2 * ROM.COMPONENTS_INNER_MARGIN);
            const totalSpacing = ROM.COMPONENTS_SPACING * (ROM.MEMORY_SIZE - 1);
            const rectangleHeight = (totalAvailableHeight - totalSpacing) / ROM.MEMORY_SIZE;
            const startYOffset =  ROM.COMPONENTS_INNER_MARGIN + rectangleHeight / 2;
            this.graphicComponentProperties.set(`ROM_TEXT_${i}`, {
                width: ROM.WIDTH - (2 * ROM.COMPONENTS_INNER_MARGIN),
                height: rectangleHeight,
                xOffset: ROM.COMPONENTS_INNER_MARGIN - ROM.COMPONENTS_INNER_MARGIN,
                yOffset: startYOffset + i * (rectangleHeight + ROM.COMPONENTS_SPACING) - ROM.HEIGHT / 2,
                color: ROM.COLORS.get("COMPONENT")
            });
        }
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
            if (instruction)
                this.textComponents.set(`ROM_TEXT_${i}`,
                    DrawUtils.drawText(instruction.toString(),
                        this.graphicComponentProperties.get(`ROM_TEXT_${i}`).xOffset + this.position.x,
                        this.graphicComponentProperties.get(`ROM_TEXT_${i}`).xOffset + this.position.y
                        + (ROM.HEIGHT / 2) - (i * (this.graphicComponentProperties.get(`ROM_TEXT_${i}`).height + ROM.COMPONENTS_SPACING)
                        + this.graphicComponentProperties.get(`ROM_TEXT_${i}`).height / 2),
                        ROM.TEXT_SIZE,
                        ROM.COLORS.get("TEXT")));
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