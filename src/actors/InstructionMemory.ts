import {Scene} from "three";
import {ComputerChip, Side} from "./ComputerChip";
import {WorkingMemory} from "./WorkingMemory";
import {AddressedInstructionBuffer} from "./macros/AddressedInstructionBuffer";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";
import {UpgradeOption} from "../dataStructures/UpgradeOption";
import {CodeGenerator} from "../dataStructures/CodeGenerator";

/**
 * The InstructionMemory class represents the instruction memory of the computer.
 */
export class InstructionMemory extends ComputerChip {
    public static readonly ADDRESS_MARGIN: number = 0.2;
    public readonly size: number;
    private readonly instructionBuffer: AddressedInstructionBuffer;

    private readonly CodeGen: CodeGenerator;

    /**
     * Creates a new instruction memory.
     *
     * @param position The position of the instruction memory.
     * @param scene The scene to which the instruction memory belongs.
     * @param workingMemory The working memory of the computer.
     * @param clockFrequency The clock frequency of the computer.
     * @param delay The delay of the instruction memory.
     * @param size The size of the instruction memory.
     */
    constructor(position: [number, number], scene: Scene, workingMemory: WorkingMemory, clockFrequency: number, delay: number,
                size: number = 16) {
        super(position, scene, clockFrequency);
        this.size = size;
        this.instructionBuffer = new AddressedInstructionBuffer(this, size,
            InstructionMemory.ADDRESS_MARGIN * 0.6 + InstructionMemory.INNER_SPACING - InstructionMemory.CONTENTS_MARGIN,
            0, delay);
        this.CodeGen = new CodeGenerator(workingMemory, size, this.instructionBuffer);
        this.initializeGraphics();
    }

    /**
     * Returns the instruction buffer of the instruction memory.
     */
    public getInstructionBuffer(): AddressedInstructionBuffer {
        return this.instructionBuffer;
    }

    getMenuOptions(): ChipMenuOptions {
        if (!this.chipMenuOptions) {
            const stats = [];
            const upgradeOptions = [
                UpgradeOption.createNumberSelection(
                    "Clock Frequency", 0,
                    "The clock frequency of the chip.", this.getClockFrequency(),
                    () => this.safeIncrementClock(),
                    () => this.safeDecrementClock()
                ),
            ];
            this.chipMenuOptions = new ChipMenuOptions(stats, upgradeOptions);
        }
        return this.chipMenuOptions;
    }

    displayName(): string {
        return "Instruction Memory";
    }

    update() {
        this.instructionBuffer.update();
        this.CodeGen.updateInstructionStream();

        if (Math.random() < 0.2)
            this.instructionBuffer.write(this.CodeGen.getInstructionStream(), 1);
    }

    initializeGraphics(): void {
        const bodyHeight = this.instructionBuffer.height + InstructionMemory.CONTENTS_MARGIN * 2;
        const bodyWidth = this.instructionBuffer.width + InstructionMemory.CONTENTS_MARGIN * 2
            + InstructionMemory.ADDRESS_MARGIN;
        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh, Side.LEFT, this.size);
        this.instructionBuffer.initializeGraphics();
    }

    private safeIncrementClock(): number {
        if (this.instructionBuffer.connectedChip && this.getClockFrequency() < (this.instructionBuffer.connectedChip.getClockFrequency() / 3))
            return this.updateClock(this.getClockFrequency() + 1)
        else
            return this.getClockFrequency()
    }

    private safeDecrementClock(): number {
        if (this.getClockFrequency() > 1)
            return this.updateClock(this.getClockFrequency() - 1)
        else
            return this.getClockFrequency()
    }
}