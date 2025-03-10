import {Instruction} from "./Instruction";
import {Queue} from "./Queue";
import {ISA} from "./ISA";
import {AddressedInstructionBuffer} from "../actors/macros/AddressedInstructionBuffer";

export class CodeGenerator {
    public static readonly MIN_DOUBLED_LOOP_SIZE: number = 7;
    public static readonly MAX_DOUBLED_LOOP_SIZE: number = 9;

    public static readonly MIN_LOOP_SIZE: number = 4;
    public static readonly MAX_LOOP_SIZE: number = 6;

    public static readonly MIN_BRANCH_SIZE: number = 4;
    public static readonly MAX_BRANCH_SIZE: number = 8;

    public static readonly MIN_SEQUENCE_SIZE: number = 4;
    public static readonly MAX_SEQUENCE_SIZE: number = 7;

    private readonly instructionStream: Queue<Instruction>;

    private forLoopProbability: number = 0.3;
    private branchProbability: number = 0.2;
    private doubleForLoopProbability: number = 0.1;
    private initializeRegistersProbability: number = 0.3;

    /**
     * Creates a new code generator.
     *
     * @param size The size of the instruction memory.
     * @param instructionBuffer The addressed instruction buffer.
     * @param workingMemorySize The size of the working memory.
     */
    constructor(private size: number, private instructionBuffer: AddressedInstructionBuffer, private workingMemorySize: number) {
        this.instructionStream = new Queue<Instruction>();
    }

    /**
     * Returns the instruction stream of the code generator.
     */
    public getInstructionStream(): Queue<Instruction> {
        return this.instructionStream;
    }

    /**
     * Updates the instruction stream of the instruction memory, ensuring that it is always filled with instructions.
     *
     * @private
     */
    public updateInstructionStream() {
        if (!this.instructionStream.isEmpty())
            return;
        let addedInstructions = 0;
        while (this.instructionStream.size() < this.size * 2) {
            if (Math.random() < this.doubleForLoopProbability) {
                const n = CodeGenerator.MIN_DOUBLED_LOOP_SIZE + Math.floor(Math.random() *
                    (CodeGenerator.MAX_DOUBLED_LOOP_SIZE - CodeGenerator.MIN_DOUBLED_LOOP_SIZE));
                this.doubleForLoop(addedInstructions, n).moveTo(this.instructionStream);
                addedInstructions += n;
            }
            if (Math.random() < this.forLoopProbability) {
                if (Math.random() < this.initializeRegistersProbability) {
                    const n = ISA.REGISTER_COUNT - 1;
                    this.initializeRegistersWorkload(n).moveTo(this.instructionStream);
                    addedInstructions += n;
                }
                const n = CodeGenerator.MIN_LOOP_SIZE + Math.floor(Math.random() *
                    (CodeGenerator.MAX_LOOP_SIZE - CodeGenerator.MIN_LOOP_SIZE));
                this.typicalForLoop(addedInstructions, n).moveTo(this.instructionStream);
                addedInstructions += n;
            } else if (Math.random() < this.branchProbability) {
                const n = CodeGenerator.MIN_BRANCH_SIZE + Math.floor(Math.random() *
                    (CodeGenerator.MAX_BRANCH_SIZE - CodeGenerator.MIN_BRANCH_SIZE));
                this.conditionalBranchWorkload(addedInstructions, n).moveTo(this.instructionStream);
                addedInstructions += n;
            } else {
                const n = CodeGenerator.MIN_SEQUENCE_SIZE + Math.floor(Math.random() *
                    (CodeGenerator.MAX_SEQUENCE_SIZE - CodeGenerator.MIN_SEQUENCE_SIZE));
                this.typicalInstructionSequence(n).moveTo(this.instructionStream);
                addedInstructions += n;
            }
        }
    }

    /**
     * Generates a typical instruction workload of n instructions.
     *
     * @param n The number of instructions to generate.
     * @param excepted The registers to avoid.
     * @private
     */
    private typicalInstructionSequence(n: number, excepted ?: number[]): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);
        const loadedRegisters = this.loadConsecutiveAddresses(typicalWorkload, n, excepted);
        const [resultRegisters, numberOfALUOperations] = this.computeOnGivenRegisters(typicalWorkload, n, loadedRegisters, excepted);
        this.storeResults(typicalWorkload, n - loadedRegisters.length - numberOfALUOperations, resultRegisters);
        return typicalWorkload;
    }

    /**
     * Generates a sequence of load operations
     * @param queue The queue to which the instructions will be added.
     * @param n The number of instructions to generate.
     * @param excepted The registers to avoid.
     * @private
     * @returns The registers that were loaded.
     */
    private loadConsecutiveAddresses(queue: Queue<Instruction>, n: number, excepted ?: number[]): number[] {
        const numberOfLoadOperations = this.getRandom(Math.floor(n * 0.6), 2);
        const loadedRegisters: number[] = this.randomConsecutiveRegs(numberOfLoadOperations, excepted);
        const randomAddresses = this.randomConsecutiveAddresses(numberOfLoadOperations);
        for (let i = 0; i < numberOfLoadOperations; ++i)
            queue.enqueue(Instruction.memory("LOAD", loadedRegisters[i], randomAddresses[i]));
        return loadedRegisters;
    }

    /**
     * Generates a sequence of ALU operations.
     * @param queue The queue to which the instructions will be added.
     * @param n The number of instructions to generate.
     * @param loadedRegisters The registers that were loaded.
     * @param excepted The registers to avoid.
     * @private
     * @returns The registers that were computed on.
     * @returns The number of ALU operations added.
     */
    private computeOnGivenRegisters(queue: Queue<Instruction>, n: number, loadedRegisters: number[], excepted ?: number[]): [Set<number>, number] {
        const numberOfALUOperations = this.getRandom(Math.floor(n * 0.5), 1);
        let resultRegisters: Set<number> = new Set();
        for (let i = 0; i < numberOfALUOperations; ++i) {
            const resultReg = this.randomReg(excepted);
            resultRegisters.add(resultReg);
            queue.enqueue(Instruction.alu(this.randomFrom(ISA.ALU_OPCODES), resultReg,
                this.randomFrom(loadedRegisters), this.randomFrom(loadedRegisters)));
        }
        return [resultRegisters, numberOfALUOperations];
    }

    /**
     * Generates a sequence of store operations.
     * @param queue The queue to which the instructions will be added.
     * @param n The number of instructions to generate.
     * @param resultRegisters The registers that were computed on.
     * @private
     */
    private storeResults(queue: Queue<Instruction>, n: number, resultRegisters: Set<number>): void {
        for (let i = 0; i < n; ++i) {
            const randomResultRegister = this.randomFromSet(resultRegisters);
            queue.enqueue(Instruction.memory("STORE", randomResultRegister,
                this.getRandom(this.workingMemorySize)));
            if (resultRegisters.size > 1)
                resultRegisters.delete(randomResultRegister);
        }
    }

    /**
     * Generates a typical for loop instruction workload of n instructions.
     *
     * @param nPreviouslyAddedInstructions The number of instructions previously added to the instruction stream.
     * @param n The number of instructions to generate.
     * @private
     */
    private typicalForLoop(nPreviouslyAddedInstructions: number, n: number): Queue<Instruction> {
        const typicalWorkload = new Queue<Instruction>(n);

        const it = this.randomReg();
        const comparedTo = this.randomReg([it]);
        typicalWorkload.enqueue(Instruction.aluImm("ADDI", it, it, 0));

        const loopBodySize = n - 3;
        if (loopBodySize > CodeGenerator.MIN_SEQUENCE_SIZE) {
            this.typicalInstructionSequence(loopBodySize, [it, comparedTo]).moveTo(typicalWorkload);
        } else {
            for (let i = 0; i < loopBodySize; ++i)
                typicalWorkload.enqueue(Instruction.alu(this.randomFrom(ISA.ALU_OPCODES),
                    this.randomReg([it, comparedTo]), this.randomReg(), this.randomReg()));
        }

        typicalWorkload.enqueue(Instruction.aluImm("ADDI", it, it, 1));
        const branchTarget = this.instructionBuffer.highestInstructionAddress() + nPreviouslyAddedInstructions + 1;
        const jumpInstruction = Instruction.branch(this.randomFrom(ISA.BRANCH_OPCODES), it, comparedTo, branchTarget);
        typicalWorkload.enqueue(jumpInstruction);

        this.instructionBuffer.setJumpInstruction(branchTarget + n - 2, jumpInstruction);

        return typicalWorkload;
    }

    /**
     * Generates a conditional branch instruction workload of n instructions.
     *
     * @param nPreviouslyAddedInstructions The number of instructions previously added to the instruction stream.
     * @param n The number of instructions to generate.
     * @private
     */
    private conditionalBranchWorkload(nPreviouslyAddedInstructions: number, n: number) {
        const workload = new Queue<Instruction>(n);
        const cmpReg = this.randomReg();
        const branchInstructionAddress = this.instructionBuffer.highestInstructionAddress() + nPreviouslyAddedInstructions;
        const branchTarget = branchInstructionAddress + n - 1;
        const branchInstruction = Instruction.branch(this.randomFrom(ISA.BRANCH_OPCODES), cmpReg, this.randomReg([cmpReg]), branchTarget);
        workload.enqueue(branchInstruction);

        const loopBodySize = n - 1;
        if (loopBodySize > CodeGenerator.MIN_SEQUENCE_SIZE) {
            this.typicalInstructionSequence(loopBodySize).moveTo(workload);
        } else {
            for (let i = 0; i < loopBodySize; ++i)
                workload.enqueue(Instruction.alu(this.randomFrom(ISA.ALU_OPCODES),
                    this.randomReg(), this.randomReg(), this.randomReg()));
        }

        this.instructionBuffer.setJumpInstruction(this.instructionBuffer.highestInstructionAddress() + nPreviouslyAddedInstructions, branchInstruction);
        return workload;
    }

    /** Generates a double for loop instruction workload of n instructions.
     *
     * @param nPreviouslyAddedInstructions The number of instructions previously added to the instruction stream.
     * @param n The number of instructions to generate.
     * @private
     */
    private doubleForLoop(nPreviouslyAddedInstructions: number, n: number): Queue<Instruction> {
        const workload = new Queue<Instruction>(n);

        const insideIt = this.randomReg();
        const insideComparedTo = this.randomReg([insideIt]);
        const outsideIt = this.randomReg([insideIt, insideComparedTo]);
        const outsideComparedTo = this.randomReg([insideIt, insideComparedTo, outsideIt]);

        workload.enqueue(Instruction.aluImm("ADDI", outsideIt, outsideIt, 0));
        workload.enqueue(Instruction.aluImm("ADDI", insideIt, insideIt, 0));
        const insideLoopSize = n - 6;

        const outsideBranchTarget = this.instructionBuffer.highestInstructionAddress() + nPreviouslyAddedInstructions + 1;
        const insideBranchTarget = outsideBranchTarget + 1

        for (let i = 0; i < insideLoopSize; ++i)
            workload.enqueue(Instruction.alu(this.randomFrom(ISA.ALU_OPCODES), this.randomReg([insideIt, outsideIt]), this.randomReg(), this.randomReg()));


        workload.enqueue(Instruction.aluImm("ADDI", insideIt, insideIt, 1));
        const insideJumpInstruction = Instruction.branch(this.randomFrom(ISA.BRANCH_OPCODES), insideIt, insideComparedTo, insideBranchTarget);
        workload.enqueue(insideJumpInstruction);
        this.instructionBuffer.setJumpInstruction(insideBranchTarget + insideLoopSize + 1, insideJumpInstruction);

        workload.enqueue(Instruction.aluImm("ADDI", outsideIt, outsideIt, 1));
        const outsideJumpInstruction = Instruction.branch(this.randomFrom(ISA.BRANCH_OPCODES), outsideIt, outsideComparedTo, outsideBranchTarget);
        workload.enqueue(outsideJumpInstruction);
        this.instructionBuffer.setJumpInstruction(outsideBranchTarget + insideLoopSize + 4, outsideJumpInstruction);

        return workload;
    }

    /**
     * Generates a workload of instructions that initialize registers.
     *
     * @param n The number of instructions to generate.
     * @private
     */
    private initializeRegistersWorkload(n: number) {
        const workload = new Queue<Instruction>(n);
        const registers = this.randomConsecutiveRegs(n);
        for (let i = 0; i < n; ++i)
            workload.enqueue(Instruction.aluImm("ADDI", registers[i], 0, this.getRandom(ISA.MAX_BYTE_VALUE, 1)));
        return workload;
    }

    /**
     * Returns a random element from the given array.
     *
     * @param array The array from which to return a random element.
     * @private
     * @returns A random element from the given array.
     */
    private randomFrom<T>(array: Array<T>): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Returns a random element from the given set.
     *
     * @param set The set from which to return a random element.
     * @private
     * @returns A random element from the given set.
     */
    private randomFromSet<T>(set: Set<T>): T {
        const randomIndex = Math.floor(Math.random() * set.size);
        let i = 0;
        for (const item of set) {
            if (i === randomIndex)
                return item;
            ++i;
        }
        return set.values().next().value;
    }

    /**
     * Returns a random register number that is not in the given array, with a safety limit on iterations.
     *
     * @param excepted The register numbers to avoid.
     * @private
     */
    private randomReg(excepted ?: number[]): number {
        let randomRegisterNumber: number;
        let attempts = 0;
        const maxAttempts = 100; // Maximum number of attempts to find a non-excepted register

        do {
            if (attempts++ >= maxAttempts) throw new Error('Max attempts reached in randomReg');
            randomRegisterNumber = this.getRandom(ISA.REGISTER_COUNT, 1); // 0 is reserved for the zero register.
        } while (excepted && excepted.includes(randomRegisterNumber));

        return randomRegisterNumber;
    }

    /**
     * Returns n random consecutive register numbers, skipping the excepted ones.
     *
     * @param n The number of consecutive register numbers to return.
     * @param excepted The register numbers to avoid.
     * @private
     */
    private randomConsecutiveRegs(n: number, excepted ?: number[]): number[] {
        let randomRegisterNumber = this.randomReg(excepted);
        let randomRegisterNumbers: number[] = [];
        let count = 0;

        while (count < n) {
            // If the current register number is not in the excepted list, add it to the result
            if (!(excepted && excepted.includes(randomRegisterNumber))) {
                randomRegisterNumbers.push(randomRegisterNumber);
                count++;
            }
            // Move to the next register, wrap around if necessary
            randomRegisterNumber = (randomRegisterNumber + 1) % ISA.REGISTER_COUNT;
        }

        return randomRegisterNumbers;
    }

    /**
     * Returns n random consecutive memory addresses.
     *
     * @param n The number of consecutive memory addresses to return.
     * @private
     */
    private randomConsecutiveAddresses(n: number): number[] {
        const randomAddress = this.getRandom(this.workingMemorySize);
        const randomAddresses: number[] = [];
        for (let i = 0; i < n; ++i)
            randomAddresses.push((randomAddress + i) % this.workingMemorySize);
        return randomAddresses;
    }

    /**
     * Returns a random number between min and max.
     *
     * @param max The maximum value.
     * @param min The minimum value.
     * @private
     */
    private getRandom(max: number, min = 0) {
        return min + Math.floor(Math.random() * (max - min));
    }
}