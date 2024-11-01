import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {Counter} from "./primitives/Counter";
import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {Instruction} from "../../dataStructures/Instruction";
import {Queue} from "../../dataStructures/Queue";
import {InstructionCache} from "./InstructionCache";
import {SISDProcessor} from "../SISDProcessor";
import {AddressedInstructionBuffer} from "./AddressedInstructionBuffer";

/**
 * Represents the instruction fetcher of a computer chip, handling the fetching of instructions.
 */
export class InstructionFetcher extends ComputerChipMacro {
    private static readonly WIDTH = 0.9;
    private static readonly SPACING = 0.01;
    private instructionMemory: AddressedInstructionBuffer | undefined;
    private readonly iCache: InstructionCache | undefined;

    private readonly pc: Counter;
    private readonly instructionBuffer: InstructionBuffer;
    private fetchingAddress: number = -1;

    /**
     * Creates an instance of the InstructionFetcher.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {number} width The width of the instruction fetcher.
     * @param iCache The instruction cache associated with the instruction fetcher.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, width: number = InstructionFetcher.WIDTH,
                iCache?: InstructionCache) {
        super(parent, xOffset, yOffset);
        this.iCache = iCache;
        this.height = InstructionBuffer.BUFFER_HEIGHT;
        this.width = width;
        this.pc = new Counter(parent, xOffset - this.width / 2 + Counter.dimensions().width / 2, yOffset);
        const bufferWidth = this.width - Counter.dimensions().width - InstructionFetcher.SPACING;
        this.instructionBuffer = new InstructionBuffer(parent, 1,
            xOffset + this.width / 2 - bufferWidth / 2, yOffset, 0, false,
            false, bufferWidth)
    }

    /**
     * Sets the instruction memory to be used by the instruction fetcher.
     *
     * @param {AddressedInstructionBuffer | undefined} instructionMemory The instruction memory to be used.
     */
    public setInstructionMemory(instructionMemory: AddressedInstructionBuffer | undefined): void {
        this.instructionMemory = instructionMemory;
    }


    /**
     * Flushes the instruction buffer.
     */
    public flush(): void {
        this.instructionBuffer.clear();
        this.fetchingAddress = -1;
        this.pc.set(0);
        this.pc.update();
    }

    /**
     * Reads the next instruction from the instruction buffer.
     *
     * @returns {Instruction} The next instruction to be executed.
     */
    public read(): Instruction | undefined {
        const instruction = this.instructionBuffer.read(1);
        return instruction ? instruction.dequeue() : undefined;
    }

    /**
     * Sets the program counter to a new value.
     *
     * @param {number} n The new value of the program counter.
     */
    public setProgramCounter(n: number): void {
        this.pc.set(n);
        if (this.fetchingAddress != n) // clear the fetch buffer if the fetch address is different from the new PC
            this.instructionBuffer.read(1);
    }

    /**
     * Fetches the next instruction from the instruction memory.
     */
    public next(): void {
        if (this.instructionBuffer.isFull())
            return;

        if (!this.checkMemoryIsReady(this.pc.get())) {
            this.fetchingAddress = this.pc.get();
            this.askForInstructionsAt(this.pc.get());
            return;
        }
        const instruction = this.fetchInstructionAt(this.pc.get());
        if (!instruction)
            return;
        const queue = new Queue<Instruction>(1);
        queue.enqueue(instruction)
        this.instructionBuffer.write(queue, 1);
        this.pc.update();
    }

    /**
     * Used to check if the next memory module is ready to be read.
     */
    private checkMemoryIsReady(address: number): boolean {
        if (this.iCache)
            return this.iCache.isReadyToBeRead(address);
        else if (this.instructionMemory != undefined)
            return this.instructionMemory.isReadyToBeRead();
        else
            return false;
    }

    /**
     * Asks the instruction memory for the instruction at the given address.
     *
     * @param {number} address The address of the instruction to be fetched.
     */
    private askForInstructionsAt(address: number): void {
        if (this.instructionMemory == undefined)
            return;

        let [index, material] = this.iCache ? this.iCache.askForInstructionAt(address) :
            this.instructionMemory.askForInstructionsAt(this.parent, 1, address);
        if (index != -1 && this.parent instanceof SISDProcessor) {
            const cpu = this.parent as SISDProcessor;
            cpu.highlightInstructionMemoryTrace(index, material!);
        }
    }

    /**
     * Fetches the instruction at the given address from the instruction memory.
     *
     * @param {number} address The address of the instruction to be fetched.
     * @returns {Instruction} The instruction at the given address.
     */
    private fetchInstructionAt(address: number): Instruction | undefined {
        if (this.instructionMemory == undefined)
            throw new Error("Instruction memory not set");

        if (this.iCache)
            return this.iCache.fetchInstructionAt(address);
        else
            return this.instructionMemory.fetchInstructionAt(address);
    }

    initializeGraphics(): void {
        this.instructionBuffer.initializeGraphics();
        this.pc.initializeGraphics();
    }

    update(): void {
        throw new Error("Instruction fetcher should not be updated manually");
    }
}