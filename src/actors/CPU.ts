import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {ROM} from "./ROM";
import {MainMemory} from "./MainMemory";
import {Queue} from "../components/Queue";

export class CPU extends ComputerChip {
    public static readonly CLOCK_SPEED: number = 0.5; // Hz

    public readonly rom: ROM;
    public readonly mainMemory: MainMemory;

    public static readonly INSTRUCTION_BUFFER_SIZE: number = 4; // Words
    private readonly instructionBuffer: Queue<Instruction>;

    public static DECODER_COUNT: number = 1;
    private readonly decoders: Queue<Instruction>;

    public static ALU_COUNT: number = 1;
    private readonly ALUs: Queue<Instruction>;
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR", "XOR", "SHL", "SHR"];

    private static readonly REGISTER_FILE_ROW_COUNT = 4;
    private static readonly REGISTER_FILE_COL_COUNT = 4;
    private static readonly REGISTER_FILE_MARGIN = 0.01;
    public static readonly REGISTER_SIZE: number = CPU.REGISTER_FILE_COL_COUNT * CPU.REGISTER_FILE_ROW_COUNT;
    public static readonly REGISTER_NAMES = [];
    static {
        for (let i = 0; i < CPU.REGISTER_SIZE; i++) this.REGISTER_NAMES.push(`R${i}`)
    }

    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];

    private readonly registerValues: Map<string, number>;
    private isPipelined: boolean;

    private static readonly WIDTH: number = 1.2;
    private static readonly HEIGHT: number = 1.2;
    private static readonly COMPONENTS_INNER_MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.02;
    private static readonly INSTRUCTION_BUFFER_HEIGHT = 0.3;
    private static readonly DECODER_HEIGHT = 0.1;
    private static readonly REGISTER_WIDTH = 0.7;

    constructor(id: string, position: [number, number], scene: Scene, rom: ROM, mainMemory: MainMemory) {
        super(id, position, scene)
        this.rom = rom
        this.mainMemory = mainMemory

        this.instructionBuffer = new Queue<Instruction>(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Queue<Instruction>(CPU.DECODER_COUNT)
        this.ALUs = new Queue<Instruction>(CPU.ALU_COUNT)
        this.registerValues = new Map<string, number>();

        CPU.REGISTER_NAMES.forEach(name => this.registerValues.set(name, 0));
        this.isPipelined = false;
    }

    public computeGraphicComponentDimensions(): void {
        const cpuBody = {
            width: CPU.WIDTH,
            height: CPU.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: CPU.COLORS.get("BODY")
        };

        const innerWidth = CPU.WIDTH - (2 * CPU.COMPONENTS_INNER_MARGIN);
        const innerHeight = CPU.HEIGHT - (2 * CPU.COMPONENTS_INNER_MARGIN);

        const instructionBuffer = {
            width: innerWidth, // Use the full inner width
            height: CPU.INSTRUCTION_BUFFER_HEIGHT,
            xOffset: 0, // Centered horizontally
            yOffset: -(innerHeight / 2) + (CPU.INSTRUCTION_BUFFER_HEIGHT / 2), // Positioned at the top
            color: CPU.COLORS.get("COMPONENT")
        };

        const decoder = {
            width: instructionBuffer.width, // Match the width of the instruction buffer
            height: CPU.DECODER_HEIGHT,
            xOffset: 0, // Centered horizontally
            yOffset: instructionBuffer.yOffset + (instructionBuffer.height / 2) + CPU.COMPONENTS_SPACING
                + (CPU.DECODER_HEIGHT / 2), // Positioned below the instruction buffer
            color: CPU.COLORS.get("COMPONENT")
        };

        const registerFile = {
            width: CPU.REGISTER_WIDTH,
            height: innerHeight - instructionBuffer.height - decoder.height - (2 * CPU.COMPONENTS_SPACING),
            xOffset: CPU.COMPONENTS_INNER_MARGIN + (CPU.REGISTER_WIDTH / 2) - (CPU.WIDTH / 2),
            yOffset: decoder.yOffset + decoder.height / 2 + CPU.COMPONENTS_SPACING +
                (innerHeight - instructionBuffer.height - decoder.height - 2 * CPU.COMPONENTS_SPACING) / 2,
            color: CPU.COLORS.get("BODY")
        };

        // Compute ALU width dynamically to fit the remaining space
        const aluWidth = innerWidth - CPU.REGISTER_WIDTH - CPU.COMPONENTS_SPACING;
        const alu = {
            width: aluWidth,
            height: registerFile.height, // Match the height of the register
            xOffset: CPU.WIDTH / 2 - CPU.COMPONENTS_INNER_MARGIN - aluWidth / 2,
            yOffset: registerFile.yOffset, // Aligned vertically with the register
            color: CPU.COLORS.get("COMPONENT")
        };

        this.graphicComponentProperties = new Map(
            [
                ["CPU", cpuBody],
                ["INSTRUCTION_BUFFER", instructionBuffer],
                ["DECODER", decoder],
                ["REGISTER_FILE", registerFile],
                ["ALU", alu]
            ]
        );

        this.drawGrid(registerFile, CPU.REGISTER_FILE_ROW_COUNT, CPU.REGISTER_FILE_COL_COUNT, CPU.REGISTER_FILE_MARGIN)
            .forEach((dimensions, name) => {
                DrawUtils.onFontLoaded(() => {
                    this.textComponents.set(name,
                        DrawUtils.buildTextMesh(name, dimensions.xOffset, dimensions.yOffset + dimensions.height / 2,
                            CPU.TEXT_SIZE / 2, CPU.COLORS.get("BODY")));
                });
            });
    }

    public update() {
        if (this.isPipelined) {
            this.processALU();
            this.decodeAll();
            this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
            this.refillInstructionBufferIfEmpty()
        }
    }

    private processALU(): void {
        if (!this.ALUs.isEmpty()) {
            const alu = this.ALUs.get(0);
            this.registerValues.set(alu.getResultReg(), this.preventOverflow(this.computeALUResult(alu)));
            this.blink(alu.getResultReg(), CPU.COLORS.get("TEXT"));
            this.blink(alu.getOp1Reg(), CPU.COLORS.get("TEXT"));
            this.blink(alu.getOp2Reg(), CPU.COLORS.get("TEXT"));
            this.ALUs.clear();
        }
    }

    private computeALUResult(alu: Instruction): number {
        const op1 = this.registerValues.get(alu.getOp1Reg());
        const op2 = this.registerValues.get(alu.getOp2Reg());
        switch (alu.getOpcode()) {
            case "ADD":
                return op1 + op2;
            case "SUB":
                return op1 - op2;
            case "MUL":
                return op1 * op2;
            case "AND":
                return op1 & op2;
            case "OR":
                return op1 | op2;
            case "XOR":
                return op1 ^ op2;
            case "SHL":
                return op1 << op2;
            case "SHR":
                return op1 >> op2;
            default:
                throw new Error("Invalid ALU opcode: " + alu.getOpcode());
        }
    }

    private preventOverflow(n: number): number {
        return n % MainMemory.MAX_VALUE;
    }

    private decodeAll(): void {
        for (let i = 0; i < CPU.DECODER_COUNT; ++i)
            if (this.decoders.get(i))
                this.decode(i);
    }

    private refillInstructionBufferIfEmpty(): void {
        if (this.instructionBuffer.isEmpty()) {
            if (!this.rom.isEmpty()) {
                let instructions = this.rom.read(CPU.INSTRUCTION_BUFFER_SIZE);
                this.moveInstructions(instructions, this.instructionBuffer, CPU.INSTRUCTION_BUFFER_SIZE);
            }
        }
    }

    private decode(index: number): void {
        const instruction = this.decoders.get(index);

        if (instruction.isArithmetic()) {
            this.ALUs.enqueue(this.decoders.dequeue())
            return;
        } else if (instruction.isMemoryOperation()) {
            if (!this.ALUs.isEmpty()) return;

            if (instruction.getOpcode() == "LOAD")
                this.registerValues.set(instruction.getResultReg(), this.mainMemory.read(instruction.getAddress()));
            else  // STORE
                this.mainMemory.write(instruction.getAddress(), this.registerValues.get(instruction.getResultReg()));

            this.blink(instruction.getResultReg(), CPU.COLORS.get("TEXT"));
            this.decoders.dequeue()
        } else {
            throw new Error("Invalid instruction: " + instruction.toString());
        }
    }

    public initializeGraphics(): void {
        this.graphicComponentProperties.forEach((_properties, name: string) => {
            this.drawSimpleGraphicComponent(name);
            this.scene.add(this.graphicComponents.get(name));
        });
    }

    drawUpdate(): void {
        this.textComponents.forEach((mesh, componentName) => {
            if (componentName.endsWith("_CONTENT") || !(this.registerValues.has(componentName)))
            {
                this.scene.remove(mesh);
                this.textComponents.delete(componentName);
            }
        });
        console.log(this.instructionBuffer);
        this.registerValues.forEach((_value, registerName) => this.drawRegisterValues(registerName));
        this.drawTextForComponent("INSTRUCTION_BUFFER", this.instructionBuffer, 0.07);
        this.drawTextForComponent("DECODER", this.decoders, 0.07);
        this.drawALUText();

        this.textComponents.forEach(comp => this.scene.add(comp));
    }

    private drawRegisterValues(registerName: string): void {
        this.textComponents.set(registerName + "_CONTENT",
            DrawUtils.buildTextMesh(this.registerValues.get(registerName).toString(),
                this.position.x + this.graphicComponentProperties.get(registerName).xOffset,
                this.position.y + this.graphicComponentProperties.get(registerName).yOffset,
                CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }

    private drawALUText(): void {
        const alu = this.ALUs.get(0);
        if (!alu) return;
        const aluProps = this.graphicComponentProperties.get("ALU");
        const distanceToCenter = 0.08;
        this.drawALUTextComponent("ALU_OP", alu.getOpcode(), aluProps.xOffset, aluProps.yOffset - 0.07);
        this.drawALUTextComponent("ALU_OP1", alu.getOp1Reg(),
            aluProps.xOffset + distanceToCenter, aluProps.yOffset - 0.15);
        this.drawALUTextComponent("ALU_OP2", alu.getOp2Reg(),
            aluProps.xOffset - distanceToCenter, aluProps.yOffset - 0.15);
        this.drawALUTextComponent("ALU_RESULT", alu.getResultReg(), aluProps.xOffset, aluProps.yOffset + 0.1);
    }

    private drawALUTextComponent(key: string, text: string, xOffset: number, yOffset: number): void {
        this.textComponents.set(key, DrawUtils.buildTextMesh(text, xOffset, yOffset, CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }

    public setPipelined(isPipelined: boolean): void {
        this.isPipelined = isPipelined;
    }
}