import {Group, Mesh, MeshBasicMaterial, Scene} from "three";
import {ComputerChip, Side} from "./ComputerChip";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../dataStructures/Queue";
import {SISDCore} from "./macros/SISDCore";
import {InstructionCache} from "./macros/InstructionCache";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";
import {UpgradeOption} from "../dataStructures/UpgradeOption";

/**
 * A Single Instruction, Single Data (SISD) processor.
 */
export class SISDProcessor extends ComputerChip {
    /** Trace constants */
    private static readonly MEMORY_TRACE_OFFSET = 0.1;
    private static readonly MEMORY_TRACE_SPACING = 0.03;

    private static readonly INSTRUCTION_MEMORY_TRACE_OFFSET = 0.1;
    private static readonly INSTRUCTION_MEMORY_TRACE_SPACING = 0.03;

    private static readonly COMPONENT_SPACING = 0.05;
    private core: SISDCore;
    private readonly iCache: InstructionCache;

    private readonly instructionMemory: InstructionMemory;
    private readonly workingMemory: WorkingMemory;

    // used for computing SISDCore metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(50);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;
    private IPC: number = 0;
    private IPS: number = 0;

    private highlightedTraces: Group[] = [];

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
                private cacheSize: number = 0) {
        super(position, scene, clockFrequency)
        this.instructionMemory = rom
        this.workingMemory = workingMemory
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
        this.drawTraces(Side.TOP, this.workingMemory, Side.BOTTOM, SISDProcessor.MEMORY_TRACE_OFFSET, SISDProcessor.MEMORY_TRACE_SPACING, 'x', true);
        this.drawTraces(Side.RIGHT, this.instructionMemory, Side.LEFT, SISDProcessor.INSTRUCTION_MEMORY_TRACE_OFFSET, SISDProcessor.INSTRUCTION_MEMORY_TRACE_SPACING, 'y');
    }

    /**
     * Returns the menu options for this processor.
     */
    public getMenuOptions(): ChipMenuOptions {
        if (!this.chipMenuOptions) {
            const stats = [
                //new Stat("Frequency", this.getClockFrequency(),  " Hz"),
                //new Stat("Has Cache", null,  this.iCache !== undefined ? "Yes" : "No"),
            ];
            const upgradeOptions = [
                UpgradeOption.createNumberSelection("Clock Frequency", 0,
                    "The clock frequency of the processor.", this.getClockFrequency(),
                    () => this.safeIncrementClock(),
                    () => this.safeDecrementClock()),

                UpgradeOption.createNumberSelection("Cache Size", 0,
                    "The size of the cache memory.", this.cacheSize,
                    () => this.increaseCacheSize(),
                    () => this.decreaseCacheSize()),
            ];
            this.chipMenuOptions = new ChipMenuOptions(stats, upgradeOptions);
        }
        return this.chipMenuOptions;
    }

    /**
     * Notifies the processor that an instruction has been retired.
     */
    public notifyInstructionRetired(): void {
        this.retiredInstructionCount++;
    }

    public highlightMainMemoryTrace(index: number, color: MeshBasicMaterial): void {
        this.highlightedTraces.push(new Group().add(
            new Mesh(this.pinGeometries.get(Side.TOP)[index], color),
            new Mesh(this.workingMemory.pinGeometries.get(Side.BOTTOM)[index], color),
            this.drawTrace(index, color, Side.TOP, this.workingMemory, Side.BOTTOM,
                SISDProcessor.MEMORY_TRACE_OFFSET, SISDProcessor.MEMORY_TRACE_SPACING, 'x', true)
        ));
        this.highlightedTraces.forEach(trace => this.scene.add(trace));
    }

    /**
     * Used to highlight a given trace with a specific color.
     *
     * @param index The index of the trace to highlight.
     * @param color The color to highlight the trace with.
     */
    public highlightInstructionMemoryTrace(index: number, color: MeshBasicMaterial): void {
        this.highlightedTraces.push(new Group().add(
            new Mesh(this.pinGeometries.get(Side.RIGHT)[index], color),
            new Mesh(this.instructionMemory.pinGeometries.get(Side.LEFT)[index], color),
            this.drawTrace(index, color, Side.RIGHT, this.instructionMemory, Side.LEFT,
                SISDProcessor.INSTRUCTION_MEMORY_TRACE_OFFSET, SISDProcessor.INSTRUCTION_MEMORY_TRACE_SPACING, 'y'))
        );
        this.highlightedTraces.forEach(mesh => this.scene.add(mesh));
    }

    /**
     * Used to clear all highlighted traces.
     */
    public clearHighlightedTraces(): void {
        this.highlightedTraces.forEach(trace => this.scene.remove(trace));
        this.highlightedTraces = [];
    }


    /**
     * Sets the clock frequency of the processor.
     */
    public getIPC(): number {
        return this.IPC;
    }

    /**
     * Gets the instructions per second (IPS) of the processor.
     */
    public getIPS(): number {
        return this.IPS;
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
        this.IPC = this.calculateAverageInstructionCount();
        this.IPS = this.IPC * this.getClockFrequency();
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
        this.drawPins(this.bodyMesh, Side.TOP, this.workingMemory.numberOfBanks * this.workingMemory.numberOfWords);
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

    private safeIncrementClock(): number {
        if (this.getClockFrequency() < ComputerChip.MAX_CLOCK_FREQUENCY)
            return this.updateClock(this.getClockFrequency() + 1)
        else
            return this.getClockFrequency()
    }

    private safeDecrementClock(): number {
        if (this.getClockFrequency() > 1 && this.getClockFrequency() > this.instructionMemory.getClockFrequency() * 3)
            return this.updateClock(this.getClockFrequency() - 1)
        else
            return this.getClockFrequency()
    }

    private increaseCacheSize(): number {
        return this.cacheSize;
    }

    private decreaseCacheSize(): number {
        return this.cacheSize;
    }
}