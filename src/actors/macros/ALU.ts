import {ComputerChipMacro} from "./ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {Mesh, PlaneGeometry} from "three";
import {InstructionBuffer} from "./InstructionBuffer";
import {DrawUtils} from "../../DrawUtils";
import {Instruction} from "../../components/Instruction";
import {DataCellArray} from "./DataCellArray";

export class ALU extends ComputerChipMacro {
    height: number = InstructionBuffer.BUFFER_HEIGHT;

    textSize: number = 0.03;

    private readonly highlightGeometry: PlaneGeometry;
    private highlighted: boolean = false;

    private instruction: Instruction;
    private registers: DataCellArray;

    constructor(parent: ComputerChip, registers: DataCellArray, xOffset: number = 0, yOffset: number = 0, width: number = 0.2) {
        super(parent, xOffset, yOffset);
        this.width = width;
        this.registers = registers;
        this.highlightGeometry = new PlaneGeometry(this.width, this.height);
    }

    public isReady(): boolean {
        return this.instruction == null;
    }

    public compute(instruction: Instruction): void {
        function computeALUResult(op1: number, op2: number, opcode: string): number {
            switch (opcode) {
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
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }

        this.instruction = instruction;
        this.drawALUText();
        this.highlight();
        this.highlighted = true;

        const op1 = this.registers.read(this.toIndex(instruction.getOp1Reg()));
        const op2 = this.registers.read(this.toIndex(instruction.getOp2Reg()));
        const result = this.preventOverflow(computeALUResult(op1, op2, instruction.getOpcode()));
        this.registers.write(this.toIndex(instruction.getResultReg()), result, this);
        this.instruction = null;
    }

    update(): void {
        if (this.highlighted)
            this.clearHighlights()
    }

    initializeGraphics(): void {
        const bodyMesh = new Mesh(this.highlightGeometry, ALU.COMPONENT_COLOR);
        bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.addStaticMesh(bodyMesh);
    }

    dispose(): void {
        super.dispose();
        this.highlightGeometry.dispose();
    }

    private highlight() {
        const highlightMesh = new Mesh(this.highlightGeometry, ComputerChipMacro.ALU_COLOR);
        highlightMesh.position.set(this.position.x, this.position.y, 0);
        this.highlightMeshes.push(highlightMesh);
        this.scene.add(highlightMesh);
        this.liveMeshes[0].material = ComputerChipMacro.COMPONENT_COLOR;
        this.highlighted = true;
    }

    clearHighlights() {
        super.clearHighlights();
        this.liveMeshes.forEach(mesh => this.scene.remove(mesh));
        this.liveMeshes = [];
        this.highlighted = false;
    }

    private drawALUText(): void {
        const drawALUTextComponent = (text: string, xOffset: number, yOffset: number): void => {
            const mesh = DrawUtils.buildTextMesh(text,
                this.position.x + xOffset,
                this.position.y + yOffset, this.textSize, ALU.COMPONENT_COLOR)
            this.liveMeshes.push(mesh);
            this.scene.add(mesh);
        };

        const opcodeSymbol = (opcode: string): string => {
            switch (opcode) {
                case "ADD":
                    return "+";
                case "SUB":
                    return "-";
                case "MUL":
                    return "x";
                case "AND":
                    return "&";
                case "OR":
                    return "v";
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }
        const distanceToCenter = 0.07;

        drawALUTextComponent(opcodeSymbol(this.instruction.getOpcode()), 0, -0.03);
        drawALUTextComponent(this.instruction.getOp1Reg(), distanceToCenter, -0.03);
        drawALUTextComponent(this.instruction.getOp2Reg(), -distanceToCenter, -0.03);
        drawALUTextComponent(this.instruction.getResultReg(), 0, 0.02);
    }

    private preventOverflow(n: number): number {
        const result = n % ComputerChip.MAX_BYTE_VALUE;
        return result >= 0 ? result : result + ComputerChip.MAX_BYTE_VALUE;
    }


    private toIndex(regName: string): number {
        return parseInt(regName.substring(1));
    }
}