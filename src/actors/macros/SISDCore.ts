import {ComputerChip} from "../ComputerChip";
import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {InstructionFetcher} from "./InstructionFetcher";
import {ALU} from "./primitives/ALU";
import {DataCellArray} from "./primitives/DataCellArray";
import {Decoder} from "./Decoder";
import {IOInterface} from "./IOInterface";
import {ISA} from "../../dataStructures/ISA";
import {InstructionMemory} from "../InstructionMemory";
import {WorkingMemory} from "../WorkingMemory";
import {InstructionCache} from "./InstructionCache";

/**
 * A Single Instruction, Single Data (SISD) processor core.
 */
export class SISDCore extends ComputerChipMacro {
    private static readonly INNER_SPACING_L = 0.02;

    private instructionFetcher: InstructionFetcher;
    private alu: ALU;
    private registers: DataCellArray[] = [];
    private IOInterface: IOInterface;
    private decoder: Decoder;

    private readonly iCache: InstructionCache | undefined;

    /**
     * Constructs a new SISDCore instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset from the parent's position to place this component.
     * @param yOffset The y-offset from the parent's position to place this component.
     * @param instructionCache The instruction cache for the SISDCore.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, instructionCache?: InstructionCache) {
        super(parent, xOffset, yOffset);
        this.iCache = instructionCache;
    }

    /**
     * Returns the dimensions of the SISDCore.
     */
    public static dimensions(): { width: number, height: number } {
        return {
            width: IOInterface.BUFFER_HEIGHT + DataCellArray.dimensions(ISA.REGISTER_COUNT / 4).width * 4 + SISDCore.INNER_SPACING_L * 3,
            height: ALU.dimensions().height * 3 + SISDCore.INNER_SPACING_L * 4 + DataCellArray.dimensions(ISA.REGISTER_COUNT / 4).height
        }
    }

    /**
     * Sets the instruction memory to be used by the core.
     */
    public setInstructionMemory(instructionMemory: InstructionMemory | undefined): void {
        if (instructionMemory == undefined) {
            this.instructionFetcher.setInstructionMemory(undefined);
        } else
            this.instructionFetcher.setInstructionMemory(instructionMemory.getInstructionBuffer());
    }

    /**
     * Sets the working memory to be used by the core.
     */
    public setWorkingMemory(workingMemory: WorkingMemory | undefined): void {
        this.IOInterface.setWorkingMemory(workingMemory);
    }

    /**
     * Sets the core to be pipelined.
     */
    public setPipelined(): void {
        this.decoder.setPipelined();
    }

    /**
     * Flushes the pipeline of the core.
     */
    public flushPipeline(): void {
        this.instructionFetcher.flush();
        this.decoder.flush();
        this.alu.flush();
        this.IOInterface.flush();
    }

    initializeGraphics(): void {
        const regColumns = 4;
        const aluDims = ALU.dimensions();
        const registerDims = DataCellArray.dimensions(ISA.REGISTER_COUNT / regColumns);
        const aluWidth = registerDims.width * regColumns + SISDCore.INNER_SPACING_L * (regColumns - 1);
        this.height = aluDims.height * 3 + SISDCore.INNER_SPACING_L * (ISA.REGISTER_COUNT / regColumns) + registerDims.height;
        this.width = IOInterface.BUFFER_HEIGHT + registerDims.width * regColumns + SISDCore.INNER_SPACING_L * regColumns;

        const registerNames = new Array(ISA.REGISTER_COUNT).fill(0).map((_, i) => `R${i}`);

        for (let i = 0; i < regColumns; i++) {
            const reg = new DataCellArray(this.parent,
                this.position.x - this.width / 2 + IOInterface.BUFFER_HEIGHT + SISDCore.INNER_SPACING_L + registerDims.width / 2
                + i * (registerDims.width + SISDCore.INNER_SPACING_L),
                this.position.y + this.height / 2 - registerDims.height / 2, ISA.REGISTER_COUNT / regColumns, 0, ISA.ZERO_REGISTER,
                registerNames.slice(i * (ISA.REGISTER_COUNT / regColumns), (i + 1) * (ISA.REGISTER_COUNT / regColumns)));
            this.registers.push(reg);
        }

        const ioLength = registerDims.height + aluDims.height + SISDCore.INNER_SPACING_L;
        this.IOInterface = new IOInterface(this.parent, this.registers,
            this.position.x - this.width / 2 + IOInterface.BUFFER_HEIGHT / 2,
            this.position.y + this.height / 2 - ioLength / 2, ioLength, true);

        this.alu = new ALU(this.parent, this.registers, this.position.x + this.width / 2 - aluWidth / 2,
            this.position.y - this.height / 2 + aluDims.height * 2 + SISDCore.INNER_SPACING_L * 2 + aluDims.height / 2, aluWidth);

        this.instructionFetcher = new InstructionFetcher(this.parent, this.position.x,
            this.position.y - this.height / 2 + aluDims.height / 2, this.width, this.iCache);

        this.decoder = new Decoder(this.parent, this.instructionFetcher, this.alu, this.IOInterface,
            this.position.x, this.position.y - this.height / 2 + aluDims.height / 2 + SISDCore.INNER_SPACING_L
            + aluDims.height, this.width);

        this.instructionFetcher.initializeGraphics();
        this.registers.forEach(r => r.initializeGraphics());
        this.alu.initializeGraphics();
        this.IOInterface.initializeGraphics();
        this.decoder.initializeGraphics();
    }

    update() {
        this.registers.forEach(r => r.update());
        this.alu.update();
        this.IOInterface.update();
        this.decoder.update();
    }
}