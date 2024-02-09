/**
 * ISA class contains the instruction set architecture for the processor.
 */
export class ISA {
    /** The operation codes for ALU operations. */
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR", "EQ", "LT"];
    /** The operation codes for immediate ALU operations. */
    public static readonly ALU_IMM_OPCODES = ["ADDI", "SUBI", "MULI"];
    /** The operation codes for memory operations. */
    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];
    /** The operation codes for branch operations. */
    public static readonly BRANCH_OPCODES = ["BEQ", "BLT"];
    /** The size of a register in bytes. */
    public static readonly REGISTER_SIZE = 4;
    /** The index of the zero register. */
    public static readonly ZERO_REGISTER = 0;
}