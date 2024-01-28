import {InstructionBuffer} from "./InstructionBuffer";
import {ComputerChip} from "../ComputerChip";
import {DataCellArray} from "./DataCellArray";
import {Queue} from "../../components/Queue";
import {Instruction} from "../../components/Instruction";
import {WorkingMemory} from "../WorkingMemory";
import {DrawUtils} from "../../DrawUtils";

export class IOInterface extends InstructionBuffer {
    private registers: DataCellArray;
    private memory: WorkingMemory;

    constructor(parent: ComputerChip, registers: DataCellArray, memory: WorkingMemory,
                xOffset: number = 0, yOffset: number = 0, bufferWidth: number = IOInterface.BUFFER_BASE_WIDTH, horizontal: boolean = true) {
        super(parent, 1, xOffset, yOffset, true, false, horizontal, bufferWidth, 0);
        this.registers = registers;
        this.memory = memory;
    }

    public isReady(): boolean {
        return this.storedInstructions.isEmpty();
    }

    public processIO(instruction: Instruction): void {
        if (this.isReady()) {
            this.storedInstructions.enqueue(instruction);
            if (this.liveMeshes[0])
                this.scene.remove(this.liveMeshes[0]);
            const mesh = this.buildBufferTextMesh(0,
                (instruction.getOpcode() == "LOAD" ? "LD " : "ST ") + "[" + DrawUtils.toHex(instruction.getAddress()) + "]"
            );
            this.liveMeshes[0] = mesh;
            this.scene.add(mesh);
            this.highlightBuffer(0);
        }

        const storedInstruction = this.storedInstructions.peek();
        if (this.memory.isReady(storedInstruction.getAddress())) {
            const resultReg = this.toIndex(storedInstruction.getResultReg());
            if (storedInstruction.getOpcode() == "LOAD") {
                this.registers.write(resultReg, this.memory.read(storedInstruction.getAddress()));
            } else if (storedInstruction.getOpcode() == "STORE")
                this.memory.write(storedInstruction.getAddress(), resultReg);
            this.storedInstructions.dequeue();
            this.scene.remove(this.liveMeshes[0]);
            this.liveMeshes = [];
            this.clearHighlights();
            const mesh = this.buildBufferTextMesh(0);
            this.liveMeshes[0] = mesh;
            this.scene.add(mesh);
        } else {
            this.memory.askForMemoryOperation(this.parent, storedInstruction.getAddress());
        }
    }

    update() {
        if (this.storedInstructions.isEmpty())
            return;
        this.processIO(this.storedInstructions.peek());
    }

    read(readCount: number): Queue<Instruction> {
        throw new Error("Decoder should not be read from.");
    }

    write(instructions: Queue<Instruction>, writeCount: number = instructions.size()) {
        throw new Error("Decoder should not be written to, use processIO() instead.");
    }

    private toIndex(regName: string): number {
        return parseInt(regName.substring(1));
    }
}