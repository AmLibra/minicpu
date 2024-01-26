import {CPU} from "../actors/CPU";
import {DrawUtils} from "../DrawUtils";

/**
 * Instruction types:
 * - ALU
 * - MEMORY
 */
enum InstructionType {
    ALU,
    MEMORY,
    BRANCH
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
            if (address === undefined)
                throw new Error("Missing memory address for MEMORY operation")
            if (op1_reg !== undefined || op2_reg !== undefined)
                throw new Error("Cannot have operand registers for MEMORY operation")

            this.type = InstructionType.MEMORY
            this.address = address;
        } else if (CPU.ALU_OPCODES.includes(opcode)) {
            if (op1_reg === undefined || op2_reg === undefined)
                throw new Error("Missing operand register for ALU operation")
            if (address !== undefined)
                throw new Error("Cannot have address for ALU operation")

            this.type = InstructionType.ALU
            this.op1Reg = op1_reg;
            this.op2Reg = op2_reg;
        } else if (CPU.BRANCH_OPCODES.includes(opcode)) {
            if (op1_reg === undefined || op2_reg === undefined)
                throw new Error("Missing operand register for BRANCH operation")
            if (address === undefined)
                throw new Error("Missing address for BRANCH operation")

            this.type = InstructionType.BRANCH
            this.op1Reg = op1_reg;
            this.op2Reg = op2_reg;
            this.address = address;
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
     * Returns true if the instruction is a branch operation
     */
    public isBranch(): boolean {
        return this.type == InstructionType.BRANCH
    }

    /**
     * Used to display the instruction in the UI
     */
    public toString(): string {
        if (this.type == InstructionType.MEMORY)
            return (this.opcode == "STORE" ? "ST" : "LD") + " " + this.resultReg + ",[" + DrawUtils.toHex(this.address) + "]";
        else if (this.type == InstructionType.ALU)
            return this.opcode + " " + this.resultReg + "," + this.op1Reg + "," + this.op2Reg;
        else if (this.type == InstructionType.BRANCH)
            return this.opcode + " " + this.op1Reg + "," + this.op2Reg + "," + DrawUtils.toHex(this.address);
        else
            throw new Error("Invalid instruction type");
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