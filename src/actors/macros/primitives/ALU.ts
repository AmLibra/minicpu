import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../../ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {InstructionBuffer} from "./InstructionBuffer";
import {DrawUtils} from "../../../DrawUtils";
import {Instruction} from "../../../dataStructures/Instruction";
import {DataCellArray} from "./DataCellArray";
import {SISDProcessor} from "../../SISDProcessor";
import {Decoder} from "../Decoder";
import {ISA} from "../../../dataStructures/ISA";

/**
 * Represents the Arithmetic Logic Unit (ALU) of a computer chip, performing arithmetic and logical operations.
 */
export class ALU extends ComputerChipMacro {
    private static readonly WIDTH = 0.2;
    height: number = InstructionBuffer.BUFFER_HEIGHT;
    width: number = 0.2;
    textSize: number = 0.03;

    private static readonly DISTANCE_TO_CENTER = 0.07;
    private static readonly OP_Y_OFFSET = -0.03;
    private static readonly RES_Y_OFFSET = 0.02;

    private readonly highlightGeometry: PlaneGeometry;
    private noOpMesh: Mesh;
    private highlighted: boolean = false;

    private branchStalling = false;
    private decoder: Decoder;

    private instruction: Instruction;
    private registers: DataCellArray;

    /**
     * Constructs a new ALU instance.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {DataCellArray} registers The registers associated with the ALU.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {number} width The width of the ALU.
     */
    constructor(parent: ComputerChip, registers: DataCellArray,xOffset: number = 0, yOffset: number = 0) {
        super(parent, xOffset, yOffset);
        this.registers = registers;
        this.highlightGeometry = new PlaneGeometry(this.width, this.height);
    }

    public static dimensions(): { width: number, height: number } {
        return { width: ALU.WIDTH, height: InstructionBuffer.BUFFER_HEIGHT };
    }

    /**
     * Checks if the ALU is ready for new instructions.
     *
     * @returns {boolean} True if no instructions are currently being processed, false otherwise.
     */
    public isReady(): boolean {
        return this.instruction == null;
    }

    /**
     * Processes an instruction by performing an arithmetic or logical operation.
     *
     * @param {Instruction} instruction The instruction to process.
     */
    public compute(decoder:Decoder, instruction: Instruction): void {
        function computeALUResult(op1: number, op2: number, opcode: string): number {
            switch (opcode) {
                case "ADDI":
                case "ADD":
                    return op1 + op2;
                case "SUBI":
                case "SUB":
                    return op1 - op2;
                case "MULI":
                case "MUL":
                    return op1 * op2;
                case "AND":
                    return op1 & op2;
                case "OR":
                    return op1 | op2;
                case "BGT":
                case "GT":
                    return op1 > op2 ? 1 : 0;
                case "BLT":
                case "LT":
                    return op1 < op2 ? 1 : 0;
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }

        this.instruction = instruction;
        this.drawALUText();
        this.highlight();

        const op1 = this.registers.read(instruction.getOp1Reg());
        const op2 = (instruction.isImmediate() ? instruction.getImmediate() :
            this.registers.read(instruction.getOp2Reg()));

        if (this.branchStalling){
            const result = computeALUResult(op1, op2, instruction.getOpcode());
            decoder.takeBranch(result == 1);
            this.instruction = null;
            this.branchStalling = false;
            return;
        }

        if (instruction.isBranch()) {
            this.branchStalling = true;
            this.decoder = decoder;
            return;
        }

        const result = this.preventOverflow(computeALUResult(op1, op2, instruction.getOpcode()));
        this.registers.write(instruction.getResultReg(), result, this);
        if (this.parent instanceof SISDProcessor)
            (this.parent as SISDProcessor).notifyInstructionRetired();
        this.instruction = null;
    }

    update(): void {
        if (this.highlighted)
            this.clearHighlights()
        if (this.branchStalling)
            this.compute(this.decoder, this.instruction);
    }

    initializeGraphics(): void {
        const bodyMesh = new Mesh(this.highlightGeometry, ALU.COMPONENT_MATERIAL);
        bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.addStaticMesh(bodyMesh);
        this.noOpMesh = DrawUtils.buildTextMesh("NOP",
            this.position.x, this.position.y,
            ComputerChipMacro.TEXT_SIZE,
            ComputerChipMacro.BODY_MATERIAL, true);
        this.scene.add(this.noOpMesh);
    }

    dispose(): void {
        super.dispose();
        this.highlightGeometry.dispose();
    }

    clearHighlights() {
        super.clearHighlights();
        this.liveMeshes.forEach(mesh => this.scene.remove(mesh));
        this.liveMeshes = [];
        this.highlighted = false;
        this.noOpMesh.visible = true;
    }

    /**
     * Highlights the ALU to indicate that it is currently processing an instruction.
     *
     * @private
     */
    private highlight() {
        const highlightMesh = new Mesh(this.highlightGeometry, ComputerChipMacro.ALU_MATERIAL);
        highlightMesh.position.set(this.position.x, this.position.y, 0);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.liveMeshes[0].material = ComputerChipMacro.COMPONENT_MATERIAL;
        this.highlighted = true;
    }

    /**
     * Draws the text of the ALU to indicate the current instruction being processed.
     *
     * @private
     */
    private drawALUText(): void {
        const drawALUTextComponent = (text: string, xOffset: number, yOffset: number): void => {
            const mesh = DrawUtils.buildTextMesh(text,
                this.position.x + xOffset,
                this.position.y + yOffset, this.textSize, ALU.COMPONENT_MATERIAL)
            this.liveMeshes.push(mesh);
            this.scene.add(mesh);
        };

        const opcodeSymbol = (opcode: string): string => {
            switch (opcode) {
                case "ADD":
                case "ADDI":
                    return "+";
                case "SUB":
                case "SUBI":
                    return "-";
                case "MUL":
                case "MULI":
                    return "x";
                case "AND":
                    return "&";
                case "OR":
                    return "v";
                case "BGT":
                case "GT":
                    return ">";
                case "BLT":
                case "LT":
                    return "<";
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }

        this.noOpMesh.visible = false;
        drawALUTextComponent(opcodeSymbol(this.instruction.getOpcode()), 0, ALU.OP_Y_OFFSET);
        drawALUTextComponent("R" + this.instruction.getOp1Reg(), ALU.DISTANCE_TO_CENTER, ALU.OP_Y_OFFSET);
        drawALUTextComponent((this.instruction.isImmediate() ?
                this.instruction.getImmediate().toString() : "R" + this.instruction.getOp2Reg()),
            -ALU.DISTANCE_TO_CENTER, ALU.OP_Y_OFFSET);
        drawALUTextComponent((this.instruction.isBranch() ? "DECODER" : "R" + this.instruction.getResultReg()),
            0, ALU.RES_Y_OFFSET);
    }

    /**
     * Prevents the result from overflowing the maximum byte value.
     *
     * @param n The result to prevent from overflowing.
     * @returns The result that has been prevented from overflowing.
     * @private
     */
    private preventOverflow(n: number): number {
        const result = n % ISA.MAX_BYTE_VALUE;
        return result >= 0 ? result : result + ISA.MAX_BYTE_VALUE;
    }
}