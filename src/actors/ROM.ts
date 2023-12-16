import {Mesh, MeshBasicMaterial, Scene} from "three";
import {Instruction} from "../components/Instruction";
import {CPU} from "./CPU";
import {DrawUtils} from "../DrawUtils";
import {GameActor} from "./GameActor";
import {FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";

export class ROM extends GameActor {
    public static readonly COLORS: Map<string, string> = new Map([
        ["BODY", DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")],
        ["COMPONENT", DrawUtils.COLOR_PALETTE.get("LIGHT")],
        ["TEXT", DrawUtils.COLOR_PALETTE.get("DARK")]
    ]);

    public static readonly MEMORY_SIZE: number = 12;
    private readonly instruction_memory: Instruction[];

    private readonly scene: Scene;
    private graphicComponents: Map<string, Mesh>;
    private readonly textComponents: Map<string, Mesh>;

    constructor(position: [number, number], scene: Scene) {
        super(position)
        this.scene = scene
        this.graphicComponents = new Map<string, Mesh>();
        this.textComponents = new Map<string, Mesh>();
        this.instruction_memory = new Array(ROM.MEMORY_SIZE)
    }

    public update() {
        if (this.getArrayBufferLength(this.instruction_memory) == 0) {
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
                const text_graphic = this.drawText(text, xOffset, yOffset, size, color, this.scene);
                this.textComponents.set(`ROM_TEXT_${i}`, text_graphic);
            }
        }
        this.textComponents.forEach(comp => this.scene.add(comp));
    }

    public read(n: number): Instruction[] {
        if (n > this.getArrayBufferLength(this.instruction_memory))
            throw new Error("Cannot read more instructions than are available in ROM")

        const instructions = new Array(n);
        for(let i= 0; i < n; ++i) {
            instructions[i] = this.instruction_memory.shift()
            this.instruction_memory.push(null)
        }
        return instructions;
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

    public generateInstruction(): Instruction {
        const opcode = CPU.ALU_OPCODES[Math.floor(Math.random() * CPU.ALU_OPCODES.length)];
        const result_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op1_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        const op2_reg = CPU.REGISTERS[Math.floor(Math.random() * CPU.REGISTERS.length)];
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }

    getArrayBufferLength(array: Array<Instruction>): number {
        return array.reduce((accumulator: number, currentValue: Instruction) => accumulator + (currentValue == null ? 0 : 1), 0);
    }
}