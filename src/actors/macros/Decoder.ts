import {InstructionBuffer} from "./InstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {Queue} from "../../components/Queue";
import {Instruction} from "../../components/Instruction";
import {DataCellArray} from "./DataCellArray";
import {InstructionFetcher} from "./InstructionFetcher";
import {ALU} from "./ALU";
import {IOInterface} from "./IOInterface";

export class Decoder extends InstructionBuffer {
    private registers: DataCellArray;
    private fetcher: InstructionFetcher;
    private alu: ALU;
    private io: IOInterface;

    constructor(parent: ComputerChip, registers: DataCellArray, fetcher: InstructionFetcher, alu: ALU, io: IOInterface,
                xOffset: number = 0, yOffset: number = 0, bufferWidth: number = Decoder.BUFFER_BASE_WIDTH, horizontal: boolean = false) {
        super(parent, 1, xOffset, yOffset, true, false, horizontal, bufferWidth, 0);
        this.registers = registers;
        this.fetcher = fetcher;
        this.alu = alu;
        this.io = io;
    }

    public decode(): void {
        if (!this.alu.isReady() || !this.io.isReady())
            return;
        const instruction = this.fetcher.read();
        if (!instruction)
            return;
        this.storedInstructions.enqueue(instruction);

        if (this.liveMeshes[0])
            this.scene.remove(this.liveMeshes[0]);

        const mesh = this.buildBufferTextMesh(0);
        this.liveMeshes[0] = mesh;
        this.scene.add(mesh);


            if (instruction.isArithmetic())
                this.alu.compute(this.storedInstructions.dequeue());
            else if (instruction.isMemoryOperation()) {
                this.io.processIO(this.storedInstructions.dequeue());
            } else if (instruction.isBranch()) {
                if (Math.random() < 0.4)
                    this.fetcher.setProgramCounter(instruction.getAddress());
                else
                    this.fetcher.notifyBranchSkipped();
                this.storedInstructions.dequeue();
            }

    }

    update() {
        super.update();
    }

    read(readCount: number): Queue<Instruction> {
        throw new Error("Decoder should not be read from");
    }
}