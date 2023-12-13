import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {GameActor} from "./GameActor";
import {Instruction} from "../components/Instruction";

export class CPU extends GameActor {
    public static readonly CLOCK_SPEED: number = 1; // Hz

    public static readonly INSTRUCTION_BUFFER_SIZE: number = 4; // Words
    public static DECODER_COUNT: number = 1;
    public static ALU_COUNT: number = 1;
    public static readonly REGISTER_SIZE: number = 12;

    public id: string;

    // processing pipeline elements
    private instructionBuffer: Instruction[];
    private decoders: Instruction[];
    private ALUs: Instruction[];
    private registers: string[];

    private is_pipelined: boolean;

    constructor(id: string, position: [number, number]) {
        super(position)
        this.id = id
        this.instructionBuffer = new Array(CPU.INSTRUCTION_BUFFER_SIZE)
        this.decoders = new Array(CPU.DECODER_COUNT)
        this.ALUs = new Array(CPU.ALU_COUNT)
        this.registers = new Array(CPU.REGISTER_SIZE)
    }

    public set_pipelined(is_pipelined: boolean): void {
        this.is_pipelined = is_pipelined;
    }

    public draw(scene: Scene): void {
        DrawUtils.draw_quadrilateral(scene, this.get_position()[0], this.get_position()[1],
            0, 1, 1, DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT"));
        // draw instruction buffer
        DrawUtils.draw_quadrilateral(scene, this.get_position()[0], this.get_position()[1] - 0.31,
            0, 0.93, 0.3, DrawUtils.COLOR_PALETTE.get("LIGHT"));
        DrawUtils.draw_quadrilateral(scene, this.get_position()[0], this.get_position()[1] - 0.05,
            0, 0.93, 0.15, DrawUtils.COLOR_PALETTE.get("LIGHT"));
        DrawUtils.draw_quadrilateral(scene, this.get_position()[0] - 0.165, this.get_position()[1] + 0.26,
            0, 0.6, 0.4, DrawUtils.COLOR_PALETTE.get("LIGHT"));
        DrawUtils.draw_quadrilateral(scene, this.get_position()[0] + 0.315, this.get_position()[1] + 0.26,
            0, 0.3, 0.4, DrawUtils.COLOR_PALETTE.get("LIGHT"));
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
            this.registers.push(this.ALUs.shift().get_result_reg());
        }

    }

    public generate_instruction(): Instruction {
        const opcode = "ADD";
        const result_reg = "R1";
        const op1_reg = "R2";
        const op2_reg = "R3";
        return new Instruction(opcode, result_reg, op1_reg, op2_reg);
    }
}