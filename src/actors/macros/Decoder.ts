import {InstructionBuffer} from "./InstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {Queue} from "../../components/Queue";
import {Instruction} from "../../components/Instruction";
import {DataCellArray} from "./DataCellArray";
import {InstructionFetcher} from "./InstructionFetcher";
import {ALU} from "./ALU";
import {IOInterface} from "./IOInterface";
import {SISDProcessor} from "../SISDProcessor";

/**
 * The Decoder class represents the decoder component of the computer chip.
 */
export class Decoder extends InstructionBuffer {
    private registers: DataCellArray;
    private fetcher: InstructionFetcher;
    private alu: ALU;
    private io: IOInterface;

    private pipelined: boolean = false;

    /**
     * Constructs a new Decoder instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param registers The register array of the computer chip.
     * @param fetcher The instruction fetcher of the computer chip.
     * @param alu The ALU of the computer chip.
     * @param io The I/O interface of the computer chip.
     * @param xOffset The x-offset from the parent's position to place this component.
     * @param yOffset The y-offset from the parent's position to place this component.
     * @param bufferWidth The width of the instruction buffer.
     * @param horizontal Whether the instruction buffer is oriented horizontally.
     */
    constructor(parent: ComputerChip, registers: DataCellArray, fetcher: InstructionFetcher, alu: ALU, io: IOInterface,
                xOffset: number = 0, yOffset: number = 0, bufferWidth: number = Decoder.BUFFER_BASE_WIDTH, horizontal: boolean = false) {
        super(parent, 1, xOffset, yOffset, true, false, horizontal, bufferWidth, 0);
        this.registers = registers;
        this.fetcher = fetcher;
        this.alu = alu;
        this.io = io;
    }

    /**
     * Sets the decoder to be pipelined.
     */
    public setPipelined(): void {
        this.pipelined = true;
    }

    /**
     * Used to take or not a branch based on the result of a condition check.
     *
     * @param conditionResult The result of the condition check.
     */
    public takeBranch(conditionResult: boolean): void {
        if (conditionResult)
            this.fetcher.setProgramCounter(this.storedInstructions.dequeue().getAddress());
        else {
            this.fetcher.notifyBranchSkipped();
            this.storedInstructions.dequeue();
        }
        if (this.parent instanceof SISDProcessor)
                (this.parent as SISDProcessor).notifyInstructionRetired();
    }


    /**
     * Decodes the next instruction in the instruction buffer.
     */
    public decode(): void {
        const executionUnitsReady = this.alu.isReady() && this.io.isReady();
        if (this.storedInstructions.isEmpty()) {
            if (!this.pipelined && !executionUnitsReady)
                return;

            const instruction = this.fetcher.read();
            if (!instruction) {
                this.fetcher.next();
                return;
            }
            this.enqueueInstruction(instruction);
        }

        if (this.pipelined && !this.storedInstructions.get(0).isBranch())
            this.fetcher.next();

        if (executionUnitsReady)
            this.decodeInstruction();
    }

    /**
     * Enqueues an instruction to be decoded.
     *
     * @param instruction The instruction to be enqueued.
     */
    private enqueueInstruction(instruction: Instruction): void {
        this.storedInstructions.enqueue(instruction);
        if (this.liveMeshes[0])
            this.scene.remove(this.liveMeshes[0]);

        const mesh = this.buildBufferTextMesh(0);
        this.liveMeshes[0] = mesh;
        this.scene.add(mesh);
    }

    /**
     * Decodes the next instruction in the instruction buffer.
     */
    private decodeInstruction(): void {
        const storedInstruction = this.storedInstructions.peek();
        if (storedInstruction.isArithmetic())
            this.alu.compute(this, this.storedInstructions.dequeue());
        else if (storedInstruction.isMemoryOperation()) {
            this.io.processIO(this.storedInstructions.dequeue());
        } else if (storedInstruction.isBranch()) {
            this.alu.compute(this, storedInstruction);
        }
    }

    update() {
        if (this.liveMeshes[0] && this.storedInstructions.isEmpty())  {
            this.scene.remove(this.liveMeshes[0]);
            this.liveMeshes[0].geometry.dispose();
            this.liveMeshes[0] = this.buildBufferTextMesh(0);
            this.scene.add(this.liveMeshes[0]);
        }
    }

    read(readCount: number): Queue<Instruction> {
        throw new Error("Decoder should not be read from");
    }
}