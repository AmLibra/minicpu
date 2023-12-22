import {CPU} from "../actors/CPU";
import {ComputerChip} from "../actors/ComputerChip";

enum InstructionType {
    ALU,
    MEMORY
}

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

    public isMemoryOperation(): boolean {
        return this.type == InstructionType.MEMORY
    }

    public isArithmetic(): boolean {
        return this.type == InstructionType.ALU
    }

    public toString(): string {
        // return this.opcode + ", " + this.resultReg + ", " + this.op1Reg + ", " + this.op2Reg + ";";
        if (this.type == InstructionType.MEMORY)
            return this.opcode + " " + this.resultReg + ", [" + ComputerChip.toHex(this.address) + "]";
        else
            return this.opcode + " " + this.resultReg + ", " + this.op1Reg + ", " + this.op2Reg;
    }

    public getOpcode(): string {
        return this.opcode;
    }

    public getOp1Reg(): string {
        if (this.type == InstructionType.MEMORY)
            throw new Error("Cannot get op1 register for memory operation")
        return this.op1Reg;
    }

    public getOp2Reg(): string {
        if (this.type == InstructionType.MEMORY)
            throw new Error("Cannot get op2 register for memory operation")
        return this.op2Reg;
    }

    public getResultReg(): string {
        return this.resultReg;
    }

    public getAddress(): number {
        if (this.type == InstructionType.ALU)
            throw new Error("Cannot get address for ALU operation")
        return this.address;
    }
}