export class Instruction {
    private readonly opcode: string;
    private readonly result_reg: string;
    private readonly op1_reg: string;
    private readonly op2_reg: string;

    constructor(opcode: string, result_reg: string, op1_reg: string, op2_reg: string) {
        this.opcode = opcode;
        this.result_reg = result_reg;
        this.op1_reg = op1_reg;
        this.op2_reg = op2_reg;
    }

    public get(): string {
        return this.opcode + ", " + this.result_reg + ", " + this.op1_reg + ", " + this.op2_reg + ";";
    }

    public get_result_reg(): string {
        return this.result_reg;
    }
}