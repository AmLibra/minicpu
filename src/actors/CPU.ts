import {Color, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {GameActor} from "./GameActor";
import {Instruction} from "../components/Instruction";
import {FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";

export class CPU extends GameActor {
    public static readonly CLOCK_SPEED: number = 1; // Hz
    private COLORS: Map<string, string> = new Map([
        ["BODY", DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")],
        ["COMPONENT", DrawUtils.COLOR_PALETTE.get("LIGHT")]
    ]);

    public static readonly INSTRUCTION_BUFFER_SIZE: number = 4; // Words
    public static DECODER_COUNT: number = 1;
    public static ALU_COUNT: number = 1;
    public static readonly REGISTER_SIZE: number = 12;

    public id: string;
    private scene: Scene;

    // processing pipeline elements
    private instructionBuffer: Instruction[];
    private decoders: Instruction[];
    private ALUs: Instruction[];
    private registers: string[];

    private is_pipelined: boolean;

    private graphicComponents: Map<string, Mesh>;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(position)
        this.id = id
        this.scene = scene
        this.graphicComponents = new Map<string, Mesh>();
        this.instructionBuffer = new Array(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Array(CPU.DECODER_COUNT)
        this.ALUs = new Array(CPU.ALU_COUNT)
        this.registers = new Array(CPU.REGISTER_SIZE)
    }

    public set_pipelined(is_pipelined: boolean): void {
        this.is_pipelined = is_pipelined;
    }

    public draw(scene: Scene): void {
        this.draw_component("CPU", 0, 0, 1, 1, "BODY");

        this.draw_component("INSTRUCTION_BUFFER",
            0, -0.31, 0.93, 0.3, "COMPONENT");
        this.draw_component("DECODER",
            0, -0.05, 0.93, 0.15, "COMPONENT");
        this.draw_component("REGISTER",
            -0.165, 0.26, 0.6, 0.4, "COMPONENT");
        this.draw_component("ALU",
            0.315, 0.26, 0.3, 0.4, "COMPONENT");

        this.graphicComponents.forEach(comp => scene.add(comp));
    }

    private draw_component(name: string, xOffset: number, yOffset: number, width: number, height: number, colorKey: string): void {
        const component = DrawUtils.drawQuadrilateral(width, height, this.COLORS.get(colorKey));
        component.position.set(this.position.x + xOffset, this.position.y + yOffset, 0);
        this.graphicComponents.set(name, component);
    }

    private draw_text(text: string, xOffset: number, yOffset: number, size: number, color: string, scene: Scene): void {

        const loader = new FontLoader();

        loader.load('../../res/Arial_Regular.json', (font) => {
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

            scene.add(textMesh);
        });
    }

    private draw_instruction_buffer(scene: Scene): void {
        // draw instruction buffer instructions
        for (let i = 0; i < CPU.INSTRUCTION_BUFFER_SIZE; i++) {
            const instruction = this.instructionBuffer[i];
            this.draw_text(instruction.get(), -0.45, -0.31 + i * 0.1, 0.1, "#000000", scene);
        }
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

    public update() {
        // refill instruction buffer if empty
        if (this.instructionBuffer.length == 0) {
            for (let i = 0; i < CPU.INSTRUCTION_BUFFER_SIZE; i++) {
                this.instructionBuffer.push(this.generate_instruction());
            }
        }

        // move instructions through pipeline
        // move first instruction from instruction buffer to decoders
        if (this.decoders.length == 0) {
            this.decoders.push(this.instructionBuffer.shift());
        }

        // move instructions from decoders to ALUs
        if (this.ALUs.length == 0) {
            this.ALUs.push(this.decoders.shift());
        }

        // move instructions from ALUs to registers
        if (this.registers.length == 0) {
            this.registers.push(this.ALUs.shift().getResultReg());
        }

        // draw instruction buffer instructions
        this.draw_text("Instruction Buffer", 0, 0, 0.1, "#000000", this.scene);
    }

    public generate_instruction(): Instruction {
        const opcode = "ADD";
        const result_reg = "R1";
        const op1_reg = "R2";
        const op2_reg = "R3";
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}