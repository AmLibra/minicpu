import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {DataCellArray} from "./primitives/DataCellArray";
import {Queue} from "../../dataStructures/Queue";
import {Instruction} from "../../dataStructures/Instruction";
import {WorkingMemory} from "../WorkingMemory";
import {DrawUtils} from "../../DrawUtils";
import {SISDProcessor} from "../SISDProcessor";

/**
 * Represents the I/O interface of a computer chip, handling I/O operations with instructions.
 */
export class IOInterface extends InstructionBuffer {
    private readonly registers: DataCellArray[];
    private memory: WorkingMemory | undefined;

    /**
     * Creates an instance of the IOInterface.
     *
     * @param {ComputerChip} parent The parent computer chip component.
     * @param {DataCellArray} registers The registers associated with the I/O interface.
     * @param {number} xOffset The x offset from the parent's position.
     * @param {number} yOffset The y offset from the parent's position.
     * @param {number} bufferWidth The width of the instruction buffer.
     * @param {boolean} horizontal Determines if the buffer is oriented horizontally.
     */
    constructor(parent: ComputerChip, registers: DataCellArray[], xOffset: number = 0,
                yOffset: number = 0, bufferWidth: number = IOInterface.BUFFER_BASE_WIDTH, horizontal: boolean = true) {
        super(parent, 1, xOffset, yOffset, 0, false, horizontal, bufferWidth, 0);
        this.registers = registers;
    }

    /**
     * Sets the working memory to be used by the I/O interface.
     *
     * @param {WorkingMemory} memory The working memory to be used.
     */

    public setWorkingMemory(memory: WorkingMemory | undefined): void {
        this.memory = memory;
    }

    /**
     * Flushes the instruction buffer.
     */
    public flush(): void {
        this.clear();
    }

    /**
     * Checks if the I/O interface is ready for new instructions.
     *
     * @returns {boolean} True if no instructions are currently being processed, false otherwise.
     */
    public isReady(): boolean {
        return this.storedInstructions.isEmpty();
    }

    /**
     * Processes an instruction by reading or writing to the memory.
     *
     * @param {Instruction} instruction The instruction to process.
     */
    public processIO(instruction: Instruction | undefined): void {
        if (instruction == undefined || this.memory == undefined)
            return;

        if (this.isReady())
            this.enqueueInstruction(instruction);

        const storedInstruction = this.storedInstructions.peek();
        if (storedInstruction == undefined)
            return;
        if (this.memory.isReady(storedInstruction.getAddress()!))
            this.executeInstruction(storedInstruction);
        else {
            this.memory.askForMemoryOperation(this.parent, storedInstruction.getAddress()!);
            if (this.parent instanceof SISDProcessor) {
                (this.parent as SISDProcessor).highlightMainMemoryTrace(
                    Math.floor(storedInstruction.getAddress()!), IOInterface.MEMORY_MATERIAL);
            }
        }
    }

    update() {
        if (this.storedInstructions.isEmpty()) {
            if (this.parent instanceof SISDProcessor) {
                let cpu = this.parent as SISDProcessor;
                cpu.clearHighlightedTraces();
            }
            return;
        }
        this.processIO(this.storedInstructions.peek());
    }

    read(_readCount: number): Queue<Instruction> {
        throw new Error("Decoder should not be read from.");
    }

    write(instructions: Queue<Instruction>, _writeCount: number = instructions.size()) {
        throw new Error("Decoder should not be written to, use processIO() instead.");
    }

    /**
     * Enqueues an instruction to be processed.
     *
     * @param {Instruction} instruction The instruction to enqueue.
     * @private
     */
    private enqueueInstruction(instruction: Instruction): void {
        this.storedInstructions.enqueue(instruction);
        if (this.liveMeshes[0])
            this.scene.remove(this.liveMeshes[0]);
        const mesh = this.buildBufferTextMesh(0, this.shortMemoryInstruction(instruction));
        this.liveMeshes[0] = mesh;
        this.scene.add(mesh);
        this.highlightBuffer(0);
    }


    /**
     * Executes the instruction by reading or writing to the memory.
     *
     * @param storedInstruction The instruction to execute.
     * @private
     */
    private executeInstruction(storedInstruction: Instruction): void {
        if (this.memory == undefined)
            return;

        const resultReg = storedInstruction.getResultReg();
        if (storedInstruction.getOpcode() == "LOAD") {
            const regPerBank = this.registers[0].getSize();
            const reg = this.registers[Math.floor(resultReg / regPerBank)];
            reg.write(resultReg % regPerBank, this.memory.read(storedInstruction.getAddress()!));
        } else if (storedInstruction.getOpcode() == "STORE")
            this.memory.write(storedInstruction.getAddress()!, resultReg);
        this.storedInstructions.dequeue();
        if (this.parent instanceof SISDProcessor)
            (this.parent as SISDProcessor).notifyInstructionRetired();
        this.updateBufferText();
    }

    /**
     * Updates the buffer text to reflect the current state of the buffer.
     *
     * @private
     */
    private updateBufferText(): void {
        this.scene.remove(this.liveMeshes[0]);
        this.liveMeshes = [];
        this.clearHighlights();
        const mesh = this.buildBufferTextMesh(0);
        this.liveMeshes[0] = mesh
        this.scene.add(mesh);
    }

    /**
     * Converts an instruction to a short memory instruction string.
     *
     * @param instruction The instruction to convert.
     * @private
     */
    private shortMemoryInstruction(instruction: Instruction): string {
        return (instruction.getOpcode() == "LOAD" ? "LD " : "ST ") + "[" + DrawUtils.toHex(instruction.getAddress()!) + "]";
    }
}