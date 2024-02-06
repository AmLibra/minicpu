import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip, Side} from "./ComputerChip";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {InstructionFetcher} from "./macros/InstructionFetcher";
import {ALU} from "./macros/ALU";
import {DataCellArray} from "./macros/DataCellArray";
import {IOInterface} from "./macros/IOInterface";
import {Decoder} from "./macros/Decoder";

export class SISDProcessor extends ComputerChip {
    private static readonly INNER_SPACING_L = 0.02;

    // ISA
    private static readonly WORDS = 1;
    protected static readonly WORD_SIZE = 4; // bytes
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR"];
    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];
    public static readonly BRANCH_OPCODES = ["BEQ", "BNE"];
    public static readonly REGISTER_SIZE = SISDProcessor.WORDS * SISDProcessor.WORD_SIZE;

    private instructionFetcher: InstructionFetcher;
    private alu: ALU;
    private registers: DataCellArray;
    private IOInterface: IOInterface;
    private decoder: Decoder;

    private readonly instructionMemory: InstructionMemory;
    private readonly workingMemory: WorkingMemory;

    private isPipelined: boolean;

    // used for computing SISDCore metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(30);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    constructor(position: [number, number], scene: Scene, rom: InstructionMemory, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene, clockFrequency)
        this.instructionMemory = rom
        this.workingMemory = workingMemory
        this.isPipelined = false;

        this.initializeGraphics();
        this.drawTraces(Side.BOTTOM, this.workingMemory, Side.TOP, 0.05, 0.02, 'x');
        this.drawTraces(Side.RIGHT, this.instructionMemory, Side.LEFT, 0.2, 0.02, 'y');
    }

    public notifyInstructionRetired(): void {
        this.retiredInstructionCount++;
    }

    public setPipelined(): void {
        if (this.isPipelined)
            return;
        this.isPipelined = true;
        this.clockFrequency *= 2;
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency), false);
    }

    public getIPC(): string {
        return (this.calculateAverageInstructionCount()).toFixed(2);
    }

    public getIPS(): string {
        return (this.calculateAverageInstructionCount() * this.clockFrequency).toFixed(2);
    }

    public getAccRetiredInstructionsCount(): number {
        return this.accumulatedInstructionCount;
    }

    displayName(): string {
        return "SISDCore";
    }

    update() {
        this.registers.update();
        this.alu.update();
        this.IOInterface.update();

        this.decoder.decode();
        this.instructionFetcher.fetchInstruction();

        this.updateRetiredInstructionCounters();
    }

    private initializeGraphics(): void {
        const ioBufferWidth = 0.4;
        const ioInterfaceWidth = new IOInterface(this, this.registers, this.workingMemory).width;
        const aluWidth = new ALU(this, this.registers).width;
        const bodyWidth: number = ioBufferWidth + aluWidth + new DataCellArray(this, 0, 0, SISDProcessor.WORD_SIZE, SISDProcessor.WORDS).width
            + SISDProcessor.INNER_SPACING_L * 2
            + SISDProcessor.CONTENTS_MARGIN * 2;
        const buffersWidth = bodyWidth - 2 * SISDProcessor.CONTENTS_MARGIN;

        const bodyHeight: number = new ALU(this, this.registers).height * 3 + SISDProcessor.INNER_SPACING_L * 2
            + SISDProcessor.CONTENTS_MARGIN * 2;
        const registerNames = [];
        for (let i = 0; i < SISDProcessor.WORDS * SISDProcessor.WORD_SIZE; i++)
            registerNames.push(`R${i}`);

        this.registers = new DataCellArray(this, bodyWidth / 2
            - new DataCellArray(this, 0, 0, SISDProcessor.WORD_SIZE, SISDProcessor.WORDS).width / 2
            - SISDProcessor.INNER_SPACING_L - SISDProcessor.CONTENTS_MARGIN - aluWidth
            , bodyHeight / 2 - new ALU(this, this.registers).height / 2 - SISDProcessor.CONTENTS_MARGIN, SISDProcessor.WORD_SIZE, SISDProcessor.WORDS, true, registerNames);

        this.IOInterface = new IOInterface(this, this.registers, this.workingMemory,
            bodyWidth / 2
            - ioBufferWidth / 2
            - new DataCellArray(this, 0, 0, SISDProcessor.WORD_SIZE, SISDProcessor.WORDS).width
            - SISDProcessor.INNER_SPACING_L * 2 - SISDProcessor.CONTENTS_MARGIN - aluWidth
            , bodyHeight / 2 - new ALU(this, this.registers).height / 2 - SISDProcessor.CONTENTS_MARGIN, ioBufferWidth, false);

        this.instructionFetcher = new InstructionFetcher(this, 0,
            -bodyHeight / 2 + ioInterfaceWidth / 2 + SISDProcessor.CONTENTS_MARGIN
            , this.instructionMemory.getInstructionBuffer(), buffersWidth);

        this.alu = new ALU(this, this.registers, bodyWidth / 2 - new ALU(this, this.registers).width / 2 - SISDProcessor.CONTENTS_MARGIN
            , bodyHeight / 2 - new ALU(this, this.registers).height / 2 - SISDProcessor.CONTENTS_MARGIN);
        this.decoder = new Decoder(this, this.registers, this.instructionFetcher, this.alu, this.IOInterface,
            0, 0, buffersWidth);

        this.instructionFetcher.initializeGraphics();
        this.registers.initializeGraphics();
        this.alu.initializeGraphics();
        this.IOInterface.initializeGraphics();
        this.decoder.initializeGraphics();

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawCPUPins();
    }

    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
    }

    private drawCPUPins(): void {
        this.drawPins(this.bodyMesh, Side.RIGHT, this.instructionMemory.size);
        this.drawPins(this.bodyMesh, Side.BOTTOM, this.workingMemory.size);
    }

    private calculateAverageInstructionCount(): number {
        let sum = 0;
        const size = this.previousRetiredInstructionCounts.size();
        if (size === 0) return 0;

        for (let i = 0; i < size; ++i)
            sum += this.previousRetiredInstructionCounts.get(i);

        return sum / size;
    }
}