import {Scene} from "three";
import {ComputerChip, Side} from "./ComputerChip";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {InstructionFetcher} from "./macros/InstructionFetcher";
import {ALU} from "./macros/ALU";
import {DataCellArray} from "./macros/DataCellArray";
import {IOInterface} from "./macros/IOInterface";
import {Decoder} from "./macros/Decoder";
import {ISA} from "../components/ISA";

/**
 * A Single Instruction, Single Data (SISD) processor.
 */
export class SISDProcessor extends ComputerChip {
    private static readonly INNER_SPACING_L = 0.02;

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
        this.isPipelined = true;
        this.decoder.setPipelined();
        this.updateClock(this.getClockFrequency() * 2);
    }

    public getIPC(): string {
        return (this.calculateAverageInstructionCount()).toFixed(2);
    }

    public getIPS(): string {
        return (this.calculateAverageInstructionCount() * this.getClockFrequency()).toFixed(2);
    }

    public getAccRetiredInstructionsCount(): number {
        return this.accumulatedInstructionCount;
    }

    displayName(): string {
        return "Single Core Processor";
    }

    update() {
        this.registers.update();
        this.alu.update();
        this.IOInterface.update();
        this.decoder.update();

        this.decoder.decode();
        this.updateRetiredInstructionCounters();
    }

    initializeGraphics(): void {
        // Single Core Single Data Processor
        const ioBufferWidth = 0.4;
        const ioInterfaceWidth = new IOInterface(this, this.registers, this.workingMemory).width;
        const aluDims = ALU.dimensions();
        const registerDims = DataCellArray.dimensions(ISA.REGISTER_SIZE, 1);
        const buffersWidth = ioBufferWidth + aluDims.width + registerDims.width + SISDProcessor.INNER_SPACING_L * 2;

        const bodyWidth: number = buffersWidth + SISDProcessor.CONTENTS_MARGIN * 2;
        const bodyHeight: number = aluDims.height * 3 + SISDProcessor.INNER_SPACING_L * 2 + SISDProcessor.CONTENTS_MARGIN * 2;

        const registerNames = [];
        for (let i = 0; i < ISA.REGISTER_SIZE ; i++)
            registerNames.push(`R${i}`);

        this.registers = new DataCellArray(this, bodyWidth / 2 - registerDims.width / 2
            - SISDProcessor.INNER_SPACING_L - SISDProcessor.CONTENTS_MARGIN - aluDims.width,
            bodyHeight / 2 - aluDims.height / 2 - SISDProcessor.CONTENTS_MARGIN, ISA.REGISTER_SIZE,
           1, true, ISA.ZERO_REGISTER, registerNames);

        this.IOInterface = new IOInterface(this, this.registers, this.workingMemory,
            bodyWidth / 2 - ioBufferWidth / 2 - registerDims.width
            - SISDProcessor.INNER_SPACING_L * 2 - SISDProcessor.CONTENTS_MARGIN - aluDims.width,
            bodyHeight / 2 - aluDims.height / 2 - SISDProcessor.CONTENTS_MARGIN, ioBufferWidth, false);

        this.alu = new ALU(this, this.registers, bodyWidth / 2 - aluDims.width / 2 - SISDProcessor.CONTENTS_MARGIN,
            bodyHeight / 2 - aluDims.height / 2 - SISDProcessor.CONTENTS_MARGIN);

        this.instructionFetcher = new InstructionFetcher(this, 0, -bodyHeight / 2 + ioInterfaceWidth / 2
            + SISDProcessor.CONTENTS_MARGIN, this.instructionMemory.getInstructionBuffer(), buffersWidth);

        this.decoder = new Decoder(this, this.registers, this.instructionFetcher, this.alu, this.IOInterface,
            0, 0, buffersWidth);

        this.instructionFetcher.initializeGraphics();
        this.registers.initializeGraphics();
        this.alu.initializeGraphics();
        this.IOInterface.initializeGraphics();
        this.decoder.initializeGraphics();
        // end of SISDCore

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh, Side.RIGHT, this.instructionMemory.size);
        this.drawPins(this.bodyMesh, Side.BOTTOM, this.workingMemory.size);
    }

    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
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