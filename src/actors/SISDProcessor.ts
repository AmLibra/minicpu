import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
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
        this.drawRightTraces(0.2, 0.02);
        this.drawBottomTraces(0.05, 0.02);
    }

    private drawBottomTraces(baseOffset: number, distanceBetweenPins: number): void {
        const halfwayWorkingMem = this.findMatchingWidth(this.workingMemory.size / 2, 'bottom')
        for (let i = 0; i < halfwayWorkingMem; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'bottom')),
                'bottom', this.workingMemory.getPinPosition(i, 'top'), 'top',
                baseOffset + (distanceBetweenPins * i)));
        }
        for (let i = halfwayWorkingMem; i < this.workingMemory.size; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'bottom')),
                'bottom', this.workingMemory.getPinPosition(i, 'top'), 'top',
                baseOffset + (distanceBetweenPins * (halfwayWorkingMem + 1)) - (distanceBetweenPins * (i - halfwayWorkingMem))));
        }
    }

    private drawRightTraces(baseOffset: number, distanceBetweenPins: number): void {
        const halfwayInstructionMem = this.findMatchingHeight(this.instructionMemory.size / 2, 'right')
        for (let i = 0; i < halfwayInstructionMem; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'right')),
                'right', this.instructionMemory.getPinPosition(i, 'left'), 'left',
                baseOffset + (distanceBetweenPins * i)));
        }
        for (let i = halfwayInstructionMem; i < this.instructionMemory.size; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'right')),
                'right', this.instructionMemory.getPinPosition(i, 'left'), 'left',
                baseOffset + (distanceBetweenPins * halfwayInstructionMem) - (distanceBetweenPins * (i - halfwayInstructionMem))));
        }
    }


    private findMatchingHeight(pin: number, side: "left" | "right" | "top" | "bottom"): number {
        const pinPositionY = this.pinPositions.get(this.pinName(pin, side)).y;
        let closest = 0;
        for (let i = 0; i < this.instructionMemory.size; ++i) {
            const instructionPositionY = this.instructionMemory.getPinPosition(i, 'left').y;
            if (Math.abs(instructionPositionY - pinPositionY) < Math.abs(
                this.instructionMemory.getPinPosition(closest, 'left').y - pinPositionY)) {
                closest = i;
            }
        }
        return closest;
    }

    private findMatchingWidth(pin: number, side: "left" | "right" | "top" | "bottom"): number {
        const pinPositionX = this.pinPositions.get(this.pinName(pin, side)).x;
        let closest = 0;
        for (let i = 0; i < this.workingMemory.size; ++i) {
            const instructionPositionX = this.workingMemory.getPinPosition(i, 'top').x;
            if (Math.abs(instructionPositionX - pinPositionX) < Math.abs(
                this.workingMemory.getPinPosition(closest, 'top').x - pinPositionX)) {
                closest = i;
            }
        }
        return closest;
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
        this.drawPins(this.bodyMesh, 'right', this.instructionMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.bodyMesh, 'bottom', this.workingMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
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