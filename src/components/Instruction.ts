import { SISDProcessor } from "../actors/SISDProcessor";
import { DrawUtils } from "../DrawUtils";

/**
 * Enum for instruction types.
 */
enum InstructionType {
    ALU = "ALU",
    MEMORY = "MEMORY",
    BRANCH = "BRANCH"
}

/**
 * Represents an instruction in the processor simulation.
 * It supports different types of instructions including ALU, MEMORY, and BRANCH operations.
 */
export class Instruction {
    private readonly opcode: string;
    private readonly resultReg: string;
    private readonly op1Reg: string;
    private readonly op2Reg: string;
    private readonly address: number;
    private readonly type: InstructionType;

    /**
     * Creates an instruction instance.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} resultReg - The name of the register where the result will be stored.
     * @param {string} [op1Reg] - The first operand register (for ALU and BRANCH operations).
     * @param {string} [op2Reg] - The second operand register (for ALU and BRANCH operations).
     * @param {number} [address] - The memory address involved in the operation (for MEMORY and BRANCH operations).
     * @throws {Error} If there are missing or extraneous parameters for a given opcode.
     */
    constructor(opcode: string, resultReg: string, op1Reg?: string, op2Reg?: string, address?: number) {
        this.opcode = opcode;
        this.resultReg = resultReg;

        if (SISDProcessor.MEMORY_OPCODES.includes(opcode)) {
            this.validateMemoryOperation(op1Reg, op2Reg, address);
            this.type = InstructionType.MEMORY;
            this.address = address!;
        } else if (SISDProcessor.ALU_OPCODES.includes(opcode)) {
            this.validateAluOperation(op1Reg, op2Reg, address);
            this.type = InstructionType.ALU;
            this.op1Reg = op1Reg!;
            this.op2Reg = op2Reg!;
        } else if (SISDProcessor.BRANCH_OPCODES.includes(opcode)) {
            this.validateBranchOperation(op1Reg, op2Reg, address);
            this.type = InstructionType.BRANCH;
            this.op1Reg = op1Reg!;
            this.op2Reg = op2Reg!;
            this.address = address!;
        } else {
            throw new Error(`Invalid opcode: ${opcode}`);
        }
    }

    /**
     * Checks if this instruction is a memory operation.
     *
     * @returns {boolean} True if the instruction is a memory operation, false otherwise.
     */
    public isMemoryOperation(): boolean {
        return this.type === InstructionType.MEMORY;
    }

    /**
     * Checks if this instruction is an ALU operation.
     *
     * @returns {boolean} True if the instruction is an ALU operation, false otherwise.
     */
    public isArithmetic(): boolean {
        return this.type === InstructionType.ALU;
    }

    /**
     * Checks if this instruction is a branch operation.
     *
     * @returns {boolean} True if the instruction is a branch operation, false otherwise.
     */
    public isBranch(): boolean {
        return this.type === InstructionType.BRANCH;
    }

    /**
     * Returns a string representation of the instruction.
     *
     * @returns {string} The string representation.
     */
    public toString(): string {
        switch (this.type) {
            case InstructionType.MEMORY:
                return `${this.opcode} ${this.resultReg},[${DrawUtils.toHex(this.address)}]`;
            case InstructionType.ALU:
                return `${this.opcode} ${this.resultReg},${this.op1Reg},${this.op2Reg}`;
            case InstructionType.BRANCH:
                return `${this.opcode} ${this.op1Reg},${this.op2Reg},${DrawUtils.toHex(this.address)}`;
            default:
                throw new Error("Invalid instruction type");
        }
    }

    /** Getter methods for instruction parameters */
    public getOpcode(): string { return this.opcode; }
    public getOp1Reg(): string { return this.type !== InstructionType.MEMORY ? this.op1Reg : undefined; }
    public getOp2Reg(): string { return this.type !== InstructionType.MEMORY ? this.op2Reg : undefined; }
    public getResultReg(): string { return this.resultReg; }
    public getAddress(): number { return this.type !== InstructionType.ALU ? this.address : undefined; }

    // Private helper methods for validating instruction parameters
    private validateMemoryOperation(op1Reg?: string, op2Reg?: string, address?: number): void {
        if (address === undefined) throw new Error("Missing memory address for MEMORY operation");
        if (op1Reg !== undefined || op2Reg !== undefined) throw new Error("Cannot have operand registers for MEMORY operation");
    }

    private validateAluOperation(op1Reg?: string, op2Reg?: string, address?: number): void {
        if (op1Reg === undefined || op2Reg === undefined) throw new Error("Missing operand register for ALU operation");
        if (address !== undefined) throw new Error("Cannot have address for ALU operation");
    }

    private validateBranchOperation(op1Reg?: string, op2Reg?: string, address?: number): void {
        if (op1Reg === undefined || op2Reg === undefined || address === undefined) throw new Error("Missing parameters for BRANCH operation");
    }
}