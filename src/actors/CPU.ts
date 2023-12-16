import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {ROM} from "./ROM";

export class CPU extends ComputerChip {
    public static readonly CLOCK_SPEED: number = 1; // Hz

    public readonly rom: ROM;

    public static readonly INSTRUCTION_BUFFER_SIZE: number = 4; // Words
    private readonly instructionBuffer: Instruction[];

    public static DECODER_COUNT: number = 1;
    private readonly decoders: Instruction[];

    public static ALU_COUNT: number = 1;
    private readonly ALUs: Instruction[];
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "DIV", "MOD", "AND", "OR", "XOR", "SHL", "SHR"];

    public static readonly REGISTER_SIZE: number = 12;
    public static readonly REGISTERS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"];
    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];

    private registers: string[];
    private isPipelined: boolean;

    private static readonly WIDTH: number = .95;
    private static readonly HEIGHT: number = 1;
    private static readonly COMPONENTS_INNER_MARGIN = 0.04;
    private static readonly COMPONENTS_SPACING = 0.02;
    private static readonly INSTRUCTION_BUFFER_HEIGHT = 0.3;
    private static readonly DECODER_HEIGHT = 0.15;
    private static readonly REGISTER_WIDTH = 0.6;

    constructor(id: string, position: [number, number], scene: Scene, rom: ROM) {
        super(id, position, scene)
        this.rom = rom
        this.computeGraphicComponentDimensions();
        this.instructionBuffer = new Array(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Array(CPU.DECODER_COUNT)
        this.ALUs = new Array(CPU.ALU_COUNT)
        this.registers = new Array(CPU.REGISTER_SIZE)
        this.isPipelined = false;
        this.setPipelined(true); // TODO: for now we are always pipelined
    }

    public computeGraphicComponentDimensions(): void {
        const cpuBody = {
            width: CPU.WIDTH,
            height: CPU.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: CPU.COLORS.get("BODY")
        };

        // Constants for inner dimensions and component spacings
        const innerWidth = CPU.WIDTH - (2 * CPU.COMPONENTS_INNER_MARGIN);
        const innerHeight = CPU.HEIGHT - (2 * CPU.COMPONENTS_INNER_MARGIN);

        // Define dimensions and positions for the instruction buffer
        const instructionBuffer = {
            width: innerWidth, // Use the full inner width
            height: CPU.INSTRUCTION_BUFFER_HEIGHT,
            xOffset: 0, // Centered horizontally
            yOffset: -(innerHeight / 2) + (CPU.INSTRUCTION_BUFFER_HEIGHT / 2), // Positioned at the top
            color: CPU.COLORS.get("COMPONENT")
        };

        // Define dimensions and positions for the decoder
        const decoder = {
            width: instructionBuffer.width, // Match the width of the instruction buffer
            height: CPU.DECODER_HEIGHT,
            xOffset: 0, // Centered horizontally
            yOffset: instructionBuffer.yOffset + (instructionBuffer.height / 2) + CPU.COMPONENTS_SPACING
                + (CPU.DECODER_HEIGHT / 2), // Positioned below the instruction buffer
            color: CPU.COLORS.get("COMPONENT")
        };

        // Define dimensions and positions for the register
        const register = {
            width: CPU.REGISTER_WIDTH,
            height: innerHeight - instructionBuffer.height - decoder.height - (2 * CPU.COMPONENTS_SPACING),
            xOffset: CPU.COMPONENTS_INNER_MARGIN + (CPU.REGISTER_WIDTH / 2) - (CPU.WIDTH / 2),
            yOffset: decoder.yOffset + decoder.height / 2 + CPU.COMPONENTS_SPACING +
                (innerHeight - instructionBuffer.height - decoder.height - 2 * CPU.COMPONENTS_SPACING) / 2,
            color: CPU.COLORS.get("COMPONENT")
        };

        // Compute ALU width dynamically to fit the remaining space
        const aluWidth = innerWidth - CPU.REGISTER_WIDTH - CPU.COMPONENTS_SPACING;

        // Define dimensions and positions for the ALU
        const alu = {
            width: aluWidth,
            height: register.height, // Match the height of the register
            xOffset: CPU.WIDTH / 2 - CPU.COMPONENTS_INNER_MARGIN - aluWidth / 2,
            yOffset: register.yOffset, // Aligned vertically with the register
            color: CPU.COLORS.get("COMPONENT")
        };

        this.graphicComponentProperties.set("CPU", cpuBody);
        this.graphicComponentProperties.set("INSTRUCTION_BUFFER", instructionBuffer);
        this.graphicComponentProperties.set("DECODER", decoder);
        this.graphicComponentProperties.set("REGISTER", register);
        this.graphicComponentProperties.set("ALU", alu);
    }

    public update() {
        if (this.isPipelined) {
            this.ALUs.fill(null);
            this.moveInstructions(this.decoders, this.ALUs, CPU.ALU_COUNT);
            this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
            if (this.getFixedArrayLength(this.instructionBuffer) == 0) {
                let instructions = this.rom.read(CPU.INSTRUCTION_BUFFER_SIZE);
                for (let i = 0; i < CPU.INSTRUCTION_BUFFER_SIZE; ++i)
                    this.instructionBuffer[i] = instructions[i]
            }
        }
        this.drawUpdate();
    }

    public draw(): void {
        this.graphicComponentProperties.forEach((_properties, name: string) => {
            this.drawGraphicComponent(name)
            this.scene.add(this.graphicComponents.get(name));
        });
    }

    public drawUpdate(): void {
        this.textComponents.forEach(comp => this.scene.remove(comp));
        this.textComponents.clear();

        this.drawTextForComponent("INSTRUCTION_BUFFER", this.instructionBuffer, 0.07);
        this.drawTextForComponent("DECODER", this.decoders, 0.07);
        this.drawALUText();

        this.textComponents.forEach(comp => this.scene.add(comp));
    }

    private drawALUText(): void {
        const alu = this.ALUs[0];
        const aluProps = this.graphicComponentProperties.get("ALU");
        if (!alu) return;

        this.drawALUTextComponent("ALU_OP", alu.getOpcode(), aluProps.xOffset, aluProps.yOffset - 0.07);
        this.drawALUTextComponent("ALU_OP1", alu.getOp1Reg(), aluProps.xOffset + 0.08, aluProps.yOffset - 0.15);
        this.drawALUTextComponent("ALU_OP2", alu.getOp2Reg(), aluProps.xOffset - 0.08, aluProps.yOffset - 0.15);
        this.drawALUTextComponent("ALU_RESULT", alu.getResultReg(), aluProps.xOffset, aluProps.yOffset + 0.1);
    }

    private drawALUTextComponent(key: string, text: string, xOffset: number, yOffset: number): void {
        this.textComponents.set(key, DrawUtils.drawText(text, xOffset, yOffset, CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }

    public setPipelined(isPipelined: boolean): void {
        this.isPipelined = isPipelined;
    }

    private moveInstructions(from: Instruction[], to: Instruction[], count: number): void {
        for (let i = 0; i < count; i++)
            if (!to[i] && from[0]) {
                to[i] = from.shift();
                from.push(null);
            }
    }
}