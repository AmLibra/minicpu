import {DrawUtils} from "../DrawUtils";
import {ISA} from "./ISA";

/**
 * Enum for instruction types.
 */
enum InstructionType {
    ALU = "ALU",
    ALU_IMM = "ALU_IMM",
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
    private readonly immediate: number;
    private readonly type: InstructionType;

    /**
     * Creates an instruction instance.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} resultReg - The name of the register where the result will be stored.
     * @param {string} [op1Reg] - The first operand register (for ALU and BRANCH operations).
     * @param {string} [op2Reg] - The second operand register (for ALU and BRANCH operations).
     * @param {number} [address] - The memory address involved in the operation (for MEMORY and BRANCH operations).
     * @param {number} [immediate] - The immediate value to use in the operation (for ALU_IMM operations).
     * @throws {Error} If there are missing or extraneous parameters for a given opcode.
     */
    private constructor(opcode: string, resultReg?: string, op1Reg?: string, op2Reg?: string, address?: number, immediate?: number) {
        this.opcode = opcode;
        if (ISA.MEMORY_OPCODES.includes(opcode)) {
            this.validateMemoryOperation(resultReg, op1Reg, op2Reg, address);
            this.type = InstructionType.MEMORY;
            this.resultReg = resultReg!;
            this.address = address!;
        } else if (ISA.ALU_OPCODES.includes(opcode)) {
            this.validateAluOperation(resultReg, op1Reg, op2Reg, address);
            this.type = InstructionType.ALU;
            this.op1Reg = op1Reg!;
            this.op2Reg = op2Reg!;
            this.resultReg = resultReg!;
        } else if (ISA.ALU_IMM_OPCODES.includes(opcode)) {
            this.validateAluImmOperation(resultReg, op1Reg, op2Reg, address, immediate);
            this.type = InstructionType.ALU_IMM;
            this.resultReg = resultReg!;
            this.op1Reg = op1Reg!;
            this.immediate = immediate!;
        } else if (ISA.BRANCH_OPCODES.includes(opcode)) {
            this.validateBranchOperation(resultReg, op1Reg, op2Reg, address);
            this.type = InstructionType.BRANCH;
            this.op1Reg = op1Reg!;
            this.op2Reg = op2Reg!;
            this.address = address!;
        } else {
            throw new Error(`Invalid opcode: ${opcode}`);
        }
    }

    /**
     * Creates a new memory instruction.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} resultReg - The name of the register where the result will be stored.
     * @param {number} address - The memory address involved in the operation.
     * @returns {Instruction} The new memory instruction.
     */
    public static memory(opcode: string, resultReg: string, address: number): Instruction {
        return new Instruction(opcode, resultReg, undefined, undefined, address);
    }

    /**
     * Creates a new ALU instruction.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} resultReg - The name of the register where the result will be stored.
     * @param {string} op1Reg - The first operand register.
     * @param {string} op2Reg - The second operand register.
     * @returns {Instruction} The new ALU instruction.
     */
    public static alu(opcode: string, resultReg: string, op1Reg: string, op2Reg: string): Instruction {
        return new Instruction(opcode, resultReg, op1Reg, op2Reg);
    }

    /**
     * Creates a new branch instruction.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} op1Reg - The first operand register.
     * @param {string} op2Reg - The second operand register.
     * @param {number} address - The memory address involved in the operation.
     * @returns {Instruction} The new branch instruction.
     */
    public static branch(opcode: string, op1Reg: string, op2Reg: string, address: number): Instruction {
        return new Instruction(opcode, undefined, op1Reg, op2Reg, address);
    }

    /**
     * Creates a new ALU instruction with an immediate value.
     *
     * @param {string} opcode - The operation code of the instruction.
     * @param {string} resultReg - The name of the register where the result will be stored.
     * @param {string} op1Reg - The first operand register.
     * @param {number} immediate - The immediate value to use in the operation.
     * @returns {Instruction} The new ALU instruction with an immediate value.
     */
    public static aluImm(opcode: string, resultReg: string, op1Reg: string, immediate: number): Instruction {
        return new Instruction(opcode, resultReg, op1Reg, undefined, undefined, immediate);
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
        return this.type === InstructionType.ALU || this.type === InstructionType.ALU_IMM;
    }

    public isImmediate(): boolean {
        return this.type === InstructionType.ALU_IMM;
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
            case InstructionType.ALU_IMM:
                return `${this.opcode} ${this.resultReg},${this.op1Reg},${this.immediate}`;
            default:
                throw new Error("Invalid instruction type");
        }
    }

    /** Getter methods for instruction parameters */
    public getOpcode(): string {
        return this.opcode;
    }

    public getOp1Reg(): string {
        return this.type !== InstructionType.MEMORY ? this.op1Reg : undefined;
    }

    public getOp2Reg(): string {
        return this.type !== InstructionType.MEMORY ? this.op2Reg : undefined;
    }

    public getImmediate(): number {
        return this.type === InstructionType.ALU_IMM ? this.immediate : undefined;
    }

    public getResultReg(): string {
        return this.resultReg;
    }

    public getAddress(): number {
        return this.type !== InstructionType.ALU ? this.address : undefined;
    }

    // Private helper methods for validating instruction parameters
    private validateMemoryOperation(resultReg?: string, op1Reg?: string, op2Reg?: string, address?: number, immediate?: number): void {
        if (address === undefined) throw new Error("Missing memory address for MEMORY operation");
        if (resultReg === undefined) throw new Error("Missing result register for MEMORY operation");
        if (op1Reg !== undefined || op2Reg !== undefined) throw new Error("Cannot have operand registers for MEMORY operation");
        if (immediate !== undefined) throw new Error("Cannot have immediate value for MEMORY operation");
    }

    private validateAluOperation(resultReg?: string, op1Reg?: string, op2Reg?: string, address?: number, immediate?: number): void {
        if (op1Reg === undefined || op2Reg === undefined) throw new Error("Missing operand register for ALU operation");
        if (resultReg === undefined) throw new Error("Missing result register for ALU operation");
        if (address !== undefined) throw new Error("Cannot have address for ALU operation");
        if (immediate !== undefined) throw new Error("Cannot have immediate value for ALU operation");
    }

    private validateBranchOperation(resultReg?: string, op1Reg?: string, op2Reg?: string, address?: number, immediate?: number): void {
        if (op1Reg === undefined || op2Reg === undefined || address === undefined) throw new Error("Missing parameters for BRANCH operation");
        if (resultReg !== undefined) throw new Error("Cannot have result register for BRANCH operation");
        if (immediate !== undefined) throw new Error("Cannot have immediate value for BRANCH operation");
    }

    private validateAluImmOperation(resultReg?: string, op1Reg?: string, op2Reg?: string, address?: number, immediate?: number): void {
        if (op1Reg === undefined || immediate === undefined) throw new Error("Missing operand register or immediate value for ALU_IMM operation");
        if (resultReg === undefined) throw new Error("Missing result register for ALU_IMM operation");
        if (op2Reg !== undefined || address !== undefined) throw new Error("Cannot have second operand register or" +
            " address for ALU_IMM operation");
    }
}