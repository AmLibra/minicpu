import {Scene} from "three";
import {ComputerChip, Side} from "./ComputerChip";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../dataStructures/Queue";
import {SISDCore} from "./macros/SISDCore";
import {InstructionCache} from "./macros/InstructionCache";

/**
 * A Single Instruction, Single Data (SISD) processor.
 */
export class SISDProcessor extends ComputerChip {
    private static readonly COMPONENT_SPACING = 0.05;
    private core: SISDCore;
    private iCache: InstructionCache;

    private readonly instructionMemory: InstructionMemory;
    private readonly workingMemory: WorkingMemory;

    private isPipelined: boolean;

    // used for computing SISDCore metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(30);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    /**
     * Constructs a new SISDProcessor instance.
     *
     * @param position The position of the processor within the scene.
     * @param scene The Three.js scene to which the processor belongs.
     * @param rom The instruction memory of the processor.
     * @param workingMemory The working memory of the processor.
     * @param clockFrequency The clock frequency of the processor.
     * @param cacheSize The size of the cache memory of the processor.
     */
    constructor(position: [number, number], scene: Scene, rom: InstructionMemory, workingMemory: WorkingMemory, clockFrequency: number,
                cacheSize: number = 0) {
        super(position, scene, clockFrequency)
        this.instructionMemory = rom
        this.workingMemory = workingMemory
        this.isPipelined = false;
        if (cacheSize > 0) {
            const coreDimensions = SISDCore.dimensions();
            const cacheDimensions = InstructionCache.dimensions(cacheSize);
            const height = coreDimensions.height + cacheDimensions.height + SISDProcessor.CONTENTS_MARGIN * 2
                + SISDProcessor.COMPONENT_SPACING;
            this.iCache = new InstructionCache(this, rom.getInstructionBuffer(), 0,
                -height / 2 + cacheDimensions.height / 2 + SISDProcessor.CONTENTS_MARGIN,
                cacheSize, coreDimensions.width);
            this.core = new SISDCore(this, 0, height / 2 - coreDimensions.height / 2
                - SISDProcessor.CONTENTS_MARGIN, rom, workingMemory, this.iCache);
        } else
            this.core = new SISDCore(this, 0, 0, rom, workingMemory);

        this.initializeGraphics();
        this.drawTraces(Side.BOTTOM, this.workingMemory, Side.TOP, 1.25, 0.02, 'x');
        this.drawTraces(Side.RIGHT, this.instructionMemory, Side.LEFT, 0.5, 0.02, 'y');
    }

    /**
     * Notifies the processor that an instruction has been retired.
     */
    public notifyInstructionRetired(): void {
        this.retiredInstructionCount++;
    }

    /**
     * Sets the clock frequency of the processor.
     */
    public setPipelined(): void {
        this.isPipelined = true;
        this.core.setPipelined();
        this.updateClock(this.getClockFrequency() * 2);
    }

    /**
     * Sets the clock frequency of the processor.
     */
    public getIPC(): number {
        return this.calculateAverageInstructionCount();
    }

    /**
     * Gets the instructions per second (IPS) of the processor.
     */
    public getIPS(): number {
        return this.calculateAverageInstructionCount() * this.getClockFrequency();
    }

    /**
     * Gets the accumulated retired instructions count.
     */
    public getAccRetiredInstructionsCount(): number {
        return this.accumulatedInstructionCount;
    }

    displayName(): string {
        return "Single Core Processor";
    }

    update() {
        this.core.update();
        this.iCache?.update();
        this.updateRetiredInstructionCounters();
    }

    initializeGraphics(): void {
        this.core.initializeGraphics();
        this.iCache?.initializeGraphics();
        let bodyWidth: number = this.core.width + SISDProcessor.CONTENTS_MARGIN * 2;
        let bodyHeight: number = this.core.height + SISDProcessor.CONTENTS_MARGIN * 2;

        if (this.iCache) {
            bodyWidth = Math.max(bodyWidth, this.iCache.width);
            bodyHeight += this.iCache.height + SISDProcessor.COMPONENT_SPACING;
        }

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh, Side.RIGHT, this.instructionMemory.size);
        this.drawPins(this.bodyMesh, Side.BOTTOM, this.workingMemory.numberOfBanks * this.workingMemory.numberOfWords);
    }

    /**
     * Updates the count of retired instructions.
     *
     * @private
     */
    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
    }

    /**
     * Calculates the average instruction count over the last n cycles.
     *
     * @private
     */
    private calculateAverageInstructionCount(): number {
        let sum = 0;
        const size = this.previousRetiredInstructionCounts.size();
        if (size === 0) return 0;

        for (let i = 0; i < size; ++i)
            sum += this.previousRetiredInstructionCounts.get(i);

        return sum / size;
    }
}