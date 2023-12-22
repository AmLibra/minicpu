import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {ROM} from "./ROM";
import {MainMemory} from "./MainMemory";

export class CPU extends ComputerChip {
    public static readonly CLOCK_SPEED: number = 0.5; // Hz

    public readonly rom: ROM;
    public readonly mainMemory: MainMemory;

    public static readonly INSTRUCTION_BUFFER_SIZE: number = 4; // Words
    private readonly instructionBuffer: Instruction[];

    public static DECODER_COUNT: number = 1;
    private readonly decoders: Instruction[];

    public static ALU_COUNT: number = 1;
    private readonly ALUs: Instruction[];
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "DIV", "MOD", "AND", "OR", "XOR", "SHL", "SHR"];

    private static readonly REGISTER_FILE_ROW_COUNT = 4;
    private static readonly REGISTER_FILE_COL_COUNT = 4;
    private static readonly REGISTER_FILE_MARGIN = 0.01;
    public static readonly REGISTER_SIZE: number = CPU.REGISTER_FILE_COL_COUNT * CPU.REGISTER_FILE_ROW_COUNT;
    public static readonly REGISTER_NAMES = [];
    static {
        for (let i = 0; i < CPU.REGISTER_SIZE; i++) this.REGISTER_NAMES.push(`R${i}`)
    }

    private skipNextInstruction: boolean = false;

    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];

    private readonly registerStates: Map<string, boolean>; // registers can be either invalid or contain a value
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
        this.computeGraphicComponentDimensions();
        this.rom = rom
        this.mainMemory = mainMemory
        this.instructionBuffer = new Array(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Array(CPU.DECODER_COUNT)
        this.ALUs = new Array(CPU.ALU_COUNT)
        this.registerStates = new Map<string, boolean>();
        this.registerValues = new Map<string, number>();
        for (let i = 0; i < CPU.REGISTER_SIZE; i++) this.registerValues.set(`R${i}`, 0)
        CPU.REGISTER_NAMES.forEach(reg => this.registerStates.set(reg, false));
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
                        DrawUtils.drawText(name, dimensions.xOffset, dimensions.yOffset + dimensions.height / 2,
                            CPU.TEXT_SIZE / 2, CPU.COLORS.get("BODY")));
                });
            });
    }

    public update() {
        if (this.isPipelined) {
            if (this.ALUs[0]) {
                this.skipNextInstruction = true;
                this.registerStates.set(this.ALUs[0].getResultReg(), true);
                this.registerStates.set(this.ALUs[0].getOp1Reg(), true);
                this.registerStates.set(this.ALUs[0].getOp2Reg(), true);
                this.ALUs.fill(null);
            }

            for (let i = 0; i < CPU.DECODER_COUNT; ++i)
                if (this.decoders[i])
                    this.decode(i);

            this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
            if (this.getFixedArrayLength(this.instructionBuffer) == 0) {
                if (!this.rom.isEmpty()) {
                    let instructions = this.rom.read(CPU.INSTRUCTION_BUFFER_SIZE);
                    for (let i = 0; i < CPU.INSTRUCTION_BUFFER_SIZE; ++i)
                        this.instructionBuffer[i] = instructions[i]
                }
            }
        }
        this.drawUpdate();
    }

    private decode(decoderIndex: number): void{
        const decoder = this.decoders[decoderIndex];
        if (this.skipNextInstruction) {
            this.skipNextInstruction = false;
            return;
        }

        if (decoder.isArithmetic()) {
            this.ALUs[0] = decoder;
            this.decoders[decoderIndex] = null;
        } else if (decoder.isMemoryOperation()) {
            if (this.ALUs[0] != null) return;
            this.decoders[decoderIndex] = null;
            this.skipNextInstruction = true;
            if (decoder.getOpcode() == "LOAD") {
                this.mainMemory.read(decoder.getAddress());
            } else if (decoder.getOpcode() == "STORE") {
                //this.mainMemory.write(decoder.getAddress(), decoder.getResultReg());
            }
            this.registerStates.set(decoder.getResultReg(), true);
        } else {
            throw new Error("Invalid instruction: " + decoder.toString());
        }
    }

    public draw(): void {
        this.graphicComponentProperties.forEach((_properties, name: string) => {
            this.drawSimpleGraphicComponent(name)
            this.scene.add(this.graphicComponents.get(name));
        });
    }

    public drawUpdate(): void {
        this.textComponents.forEach(comp => this.scene.remove(comp));
        this.textComponents.forEach((value, key) => {
            if (!this.registerStates.has(key) && !this.registerStates.has(key.replace("_CONTENT", ""))) {
                this.scene.remove(value);
                this.textComponents.delete(key);
            }
        });
        this.registerStates.forEach((active, component) => {
            if (component) {
                DrawUtils.onFontLoaded(() => {
                        this.textComponents.set(component + "_CONTENT",
                            DrawUtils.drawText(this.registerValues.get(component).toString(),
                                this.position.x + this.graphicComponentProperties.get(component).xOffset,
                                this.position.y + this.graphicComponentProperties.get(component).yOffset,
                                CPU.TEXT_SIZE, CPU.COLORS.get("TEXT") ));
                    }
                );
                if (active) {
                    this.blink(component, CPU.COLORS.get("TEXT"));
                    this.registerStates.set(component, false);

                }
            }
        });

        this.drawTextForComponent("INSTRUCTION_BUFFER", this.instructionBuffer, 0.07);
        this.drawTextForComponent("DECODER", this.decoders, 0.07);
        this.drawALUText();

        this.textComponents.forEach(comp => this.scene.add(comp));
        console.log(this.textComponents);
    }

    private drawALUText(): void {
        const alu = this.ALUs[0];
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
        this.textComponents.set(key, DrawUtils.drawText(text, xOffset, yOffset, CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }

    public setPipelined(isPipelined: boolean): void {
        this.isPipelined = isPipelined;
    }
}