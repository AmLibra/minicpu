import {CPU} from "../actors/CPU";

export class Instruction {
    private readonly opcode: string;
    private readonly resultReg: string;
    private readonly op1Reg: string;
    private readonly op2Reg: string;

    constructor(opcode: string, result_reg: string, op1_reg: string, op2_reg: string) {
        this.opcode = opcode;
        this.resultReg = result_reg;
        this.op1Reg = op1_reg;
        this.op2Reg = op2_reg;
    }

    public isMemoryOperation(): boolean {
        return this.opcode in CPU.MEMORY_OPCODES
    }

    public isArithmetic(): boolean {
        return this.opcode in CPU.ALU_OPCODES
    }

    public toString(): string {
        return this.opcode + ", " + this.resultReg + ", " + this.op1Reg + ", " + this.op2Reg + ";";
    }

    public getResultReg(): string {
        return this.resultReg;
    }
}