import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {ComputerChip} from "../ComputerChip";
import {InstructionCacheLine} from "./InstructionCacheLine";

export class InstructionCache extends ComputerChipMacro {
    private readonly cacheLines: InstructionCacheLine[];
    private static readonly INNER_SPACING = 0.01;

    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, size: number = 4) {
        super(parent, xOffset, yOffset);
        this.cacheLines = [];
        const cacheLineHeight = InstructionCacheLine.dimensions().height;
        const totalHeight = size * cacheLineHeight + (size - 1) * InstructionCache.INNER_SPACING;

        for (let i = 0; i < size; i++) {
            this.cacheLines.push(new InstructionCacheLine(parent, xOffset,
                yOffset + totalHeight / 2 - (i + 1) * (cacheLineHeight + InstructionCache.INNER_SPACING)));
        }
    }

    initializeGraphics(): void {
        this.cacheLines.forEach(line => line.initializeGraphics());
    }

    update(): void {
        this.cacheLines.forEach(line => line.update());
    }
}