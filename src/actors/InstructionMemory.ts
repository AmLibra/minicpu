import {ComputerChip, Side} from "./ComputerChip";
import {AddressedInstructionBuffer} from "./macros/AddressedInstructionBuffer";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";
import {UpgradeOption} from "../dataStructures/UpgradeOption";
import {CodeGenerator} from "../dataStructures/CodeGenerator";
import {App} from "../app";

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
     * @param app The main application class.
     * @param clockFrequency The clock frequency of the computer.
     * @param delay The delay of the instruction memory.
     * @param workingMemorySize The size of the working memory.
     * @param size The size of the instruction memory.
     */
    constructor(private app: App, clockFrequency: number, delay: number, workingMemorySize: number,
                size: number = 16) {
        super([0, 0], app.scene, clockFrequency);
        this.size = size;
        this.instructionBuffer = new AddressedInstructionBuffer(this, size,
            InstructionMemory.ADDRESS_MARGIN * 0.6 + InstructionMemory.INNER_SPACING - InstructionMemory.CONTENTS_MARGIN,
            0, delay);
        this.CodeGen = new CodeGenerator(size, this.instructionBuffer, workingMemorySize);
    }

    /**
     * Returns the instruction buffer of the instruction memory.
     */
    public getInstructionBuffer(): AddressedInstructionBuffer {
        return this.instructionBuffer;
    }

    /**
     * Computes the dimensions of the instruction memory
     */
    public dimensions(): { width: number, height: number } {
        return {
            width: this.instructionBuffer.width + InstructionMemory.CONTENTS_MARGIN * 2,
            height: this.instructionBuffer.height + InstructionMemory.CONTENTS_MARGIN * 2
        }
    }

    /**
     * Changes the position of the instruction memory.
     */
    public setPosition(position: [number, number]): void {
        this.position = {x: position[0], y: position[1]};
        this.instructionBuffer
            .setPosition([position[0] + InstructionMemory.ADDRESS_MARGIN * 0.6 + InstructionMemory.INNER_SPACING - InstructionMemory.CONTENTS_MARGIN,
            position[1]]);
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
        this.drawPins(this.bodyMesh!, Side.LEFT, this.size);
        this.instructionBuffer.initializeGraphics();
    }

    disposeGraphics(): void {
        super.disposeBodyMesh();
        this.clearTracesAndPins(Side.LEFT);
        this.instructionBuffer.dispose();
        this.app.removeGameActor(this);
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