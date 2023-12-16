import {Color, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {GameActor} from "./GameActor";
import {Instruction} from "../components/Instruction";
import {FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";
import {ROM} from "./ROM";

export class CPU extends GameActor {
    public static readonly CLOCK_SPEED: number = 1; // Hz

    public readonly id: string;
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
    private is_pipelined: boolean;

    private readonly scene: Scene;
    private static readonly COLORS: Map<string, string> = new Map([
        ["BODY", DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")],
        ["COMPONENT", DrawUtils.COLOR_PALETTE.get("LIGHT")],
        ["TEXT", DrawUtils.COLOR_PALETTE.get("DARK")]
    ]);
    private graphicComponents: Map<string, Mesh>;
    private readonly textComponents: Map<string, Mesh>;

    constructor(id: string, position: [number, number], scene: Scene, rom: ROM) {
        super(position)
        this.id = id
        this.rom = rom
        this.scene = scene
        this.graphicComponents = new Map<string, Mesh>();
        this.textComponents = new Map<string, Mesh>();
        this.instructionBuffer = new Array(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Array(CPU.DECODER_COUNT)
        this.ALUs = new Array(CPU.ALU_COUNT)
        this.registers = new Array(CPU.REGISTER_SIZE)
    }

    public update() {
        this.ALUs.fill(null);
        this.moveInstructions(this.decoders, this.ALUs, CPU.ALU_COUNT);
        this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
        if (this.getArrayBufferLength(this.instructionBuffer) == 0) {
            let instructions = this.rom.read(CPU.INSTRUCTION_BUFFER_SIZE);
            for (let i = 0; i < CPU.INSTRUCTION_BUFFER_SIZE; ++i) {
                this.instructionBuffer[i] = instructions[i]
            }
        }

        this.drawUpdate(this.scene);
    }

    private moveInstructions(from: Instruction[], to: Instruction[], count: number): void {
        for (let i = 0; i < count; i++)
            if (!to[i] && from[0]) {
                to[i] = from.shift();
                from.push(null);
            }
    }

    public draw(): void {
        this.drawComponent("CPU", 0, 0, 1, 1, "BODY");

        this.drawComponent("INSTRUCTION_BUFFER",
            0, -0.31, 0.93, 0.3, "COMPONENT");
        this.drawComponent("DECODER",
            0, -0.05, 0.93, 0.15, "COMPONENT");
        this.drawComponent("REGISTER",
            -0.165, 0.26, 0.6, 0.4, "COMPONENT");
        this.drawComponent("ALU",
            0.315, 0.26, 0.3, 0.4, "COMPONENT");

        this.graphicComponents.forEach(comp => this.scene.add(comp));
    }

    public drawUpdate(scene: Scene): void {
        this.clearTextComponents(scene);

        this.drawTextForComponents(this.instructionBuffer, "INSTRUCTION_BUFFER", 0, -0.44, 0.07, scene);
        this.drawTextForComponents(this.decoders, "DECODER", 0, -0.08, 0.07, scene);

        const OP = this.drawText(this.ALUs[0] ? this.ALUs[0].toString().split(",")[0] : "",
            0.315, 0.17, 0.05, CPU.COLORS.get("TEXT"), scene);
        this.textComponents.set("ALU_OP", OP)
        const OP1 = this.drawText(this.ALUs[0] ? this.ALUs[0].toString().split(",")[2] : "",
            0.2, 0.1, 0.05, CPU.COLORS.get("TEXT"), scene);
        this.textComponents.set("ALU_OP1", OP1)
        const OP2 = this.drawText(this.ALUs[0] ? this.ALUs[0]
                    .toString().split(",")[3].replace(";", "")
                : "",
            0.35, 0.1, 0.05, CPU.COLORS.get("TEXT"), scene);
        this.textComponents.set("ALU_OP2", OP2)
        const RES = this.drawText(this.ALUs[0] ? this.ALUs[0].toString().split(",")[1] : "",
            0.27, 0.33, 0.05, CPU.COLORS.get("TEXT"), scene);
        this.textComponents.set("ALU_RES", RES)

        this.textComponents.forEach(comp => scene.add(comp));
    }

    private clearTextComponents(scene: Scene): void {
        this.textComponents.forEach(comp => scene.remove(comp));
        this.textComponents.clear();
    }

    private drawTextForComponents(components: Instruction[], componentName: string, xOffset: number, yOffsetStart: number, yOffsetIncrement: number, scene: Scene): void {
        for (let i = 0; i < components.length; i++) {
            const instruction = components[components.length - i - 1];
            if (instruction) {
                const yPos = yOffsetStart + yOffsetIncrement * i;
                const instructionGraphic =
                    this.drawText(instruction.toString(), xOffset, yPos, 0.05, CPU.COLORS.get("TEXT"), scene);
                this.textComponents.set(`${componentName}_${i}`, instructionGraphic);
            }
        }
    }

    private drawComponent(name: string, xOffset: number, yOffset: number, width: number, height: number, colorKey: string): void {
        const component = DrawUtils.drawQuadrilateral(width, height, CPU.COLORS.get(colorKey));
        component.position.set(this.position.x + xOffset, this.position.y + yOffset, 0);
        this.graphicComponents.set(name, component);
    }

    private drawText(text: string, xOffset: number, yOffset: number, size: number, color: string, scene: Scene): Mesh {
        const loader = new FontLoader();
        const text_graphic = new Mesh();
        loader.load('../../res/Courier_New_Bold.json', (font) => {
            const textGeometry = new TextGeometry(text, {
                font: font,
                size: size,
                height: 0.1, // Thickness of the text
                curveSegments: 12,
                bevelEnabled: false
            });
            const textMaterial = new MeshBasicMaterial({ color: color });
            const textMesh = new Mesh(textGeometry, textMaterial);

            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            textMesh.position.set(xOffset - textWidth / 2, yOffset, 0);

            text_graphic.add(textMesh);
        });
        return text_graphic;
    }


    public changeComponentColor(componentName: string, newColor: string | number | Color): void {
        const component = this.graphicComponents.get(componentName);
        if (component && component.material instanceof MeshBasicMaterial) {
            component.material.color.set(newColor);
            component.material.needsUpdate = true; // This line might be necessary to tell Three.js to update the material
        } else {
            console.warn('Component not found or has incompatible material');
        }
    }

    public set_pipelined(is_pipelined: boolean): void {
        this.is_pipelined = is_pipelined;
    }

    getArrayBufferLength(array: Array<Instruction>): number {
        return array.reduce((accumulator: number, currentValue: Instruction) => accumulator + (currentValue == null ? 0 : 1), 0);
    }

    public generate_instruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op1_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op2_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}