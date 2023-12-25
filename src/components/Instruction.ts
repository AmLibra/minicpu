import {CPU} from "../actors/CPU";
import {ComputerChip} from "../actors/ComputerChip";

/**
 * Instruction types:
 * - ALU
 * - MEMORY
 */
enum InstructionType {
    ALU,
    MEMORY
}

/**
 * Instruction class
 *
 * @class Instruction
 *
 * @param {string} opcode - The instruction opcode
 * @param {string} result_reg - The instruction result register
 * @param {string} op1_reg - The instruction operand 1 register (only for ALU operations)
 * @param {string} op2_reg - The instruction operand 2 register (only for ALU operations)
 * @param {number} address - The instruction memory address (only for memory operations)
 * @param {InstructionType} type - The instruction type
 */
export class Instruction {
    private readonly opcode: string;
    private readonly resultReg: string;
    private readonly op1Reg: string;
    private readonly op2Reg: string;
    private readonly address: number;
    private readonly type: InstructionType;

    constructor(opcode: string, result_reg: string, op1_reg?: string, op2_reg?: string, address?: number) {
        this.opcode = opcode;
        this.resultReg = result_reg;
        if (CPU.MEMORY_OPCODES.includes(opcode)) {
            this.type = InstructionType.MEMORY
            this.address = address;
        } else {
            this.type = InstructionType.ALU
            this.op1Reg = op1_reg;
            this.op2Reg = op2_reg;
        }
    }

    /**
     * Returns true if the instruction is a memory operation
     */
    public isMemoryOperation(): boolean {
        return this.type == InstructionType.MEMORY
    }

    /**
     * Returns true if the instruction is an arithmetic operation
     */
    public isArithmetic(): boolean {
        return this.type == InstructionType.ALU
    }

    /**
     * Used to display the instruction in the UI
     */
    public toString(): string {
        // return this.opcode + ", " + this.resultReg + ", " + this.op1Reg + ", " + this.op2Reg + ";";
        if (this.type == InstructionType.MEMORY)
            return this.opcode + " " + this.resultReg + ", [" + ComputerChip.toHex(this.address) + "]";
        else
            return this.opcode + " " + this.resultReg + ", " + this.op1Reg + ", " + this.op2Reg;
    }

    /**
     * Returns the instruction opcode
     */
    public getOpcode(): string {
        return this.opcode;
    }

    /**
     * Returns the first operand register
     */
    public getOp1Reg(): string {
        if (this.type == InstructionType.MEMORY)
            throw new Error("Cannot get op1 register for memory operation")
        return this.op1Reg;
    }

    /**
     * Returns the second operand register
     */
    public getOp2Reg(): string {
        if (this.type == InstructionType.MEMORY)
            throw new Error("Cannot get op2 register for memory operation")
        return this.op2Reg;
    }

    /**
     * Returns the result register
     */
    public getResultReg(): string {
        return this.resultReg;
    }

    /**
     * Returns the target memory address for memory operations
     */
    public getAddress(): number {
        if (this.type == InstructionType.ALU)
            throw new Error("Cannot get address for ALU operation")
        return this.address;
    }
}