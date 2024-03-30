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
    private static readonly IO_INTERFACE_WIDTH = 0.4;
    private static readonly INNER_SPACING_L = 0.02;

    private instructionFetcher: InstructionFetcher;
    private alu: ALU;
    private registers: DataCellArray;
    private IOInterface: IOInterface;
    private decoder: Decoder;

    private readonly instructionMemory: InstructionMemory;
    private readonly iCache: InstructionCache;
    private readonly workingMemory: WorkingMemory;

    /**
     * Constructs a new SISDCore instance.
     *
     * @param parent The parent ComputerChip instance.
     * @param xOffset The x-offset from the parent's position to place this component.
     * @param yOffset The y-offset from the parent's position to place this component.
     * @param rom The instruction memory for the SISDCore.
     * @param workingMemory The working memory for the SISDCore.
     * @param instructionCache The instruction cache for the SISDCore.
     */
    constructor(parent: ComputerChip, xOffset: number = 0, yOffset: number = 0, rom: InstructionMemory,
                workingMemory: WorkingMemory, instructionCache?: InstructionCache) {
        super(parent, xOffset, yOffset);
        this.instructionMemory = rom;
        this.workingMemory = workingMemory;
        this.iCache = instructionCache;
    }

    /**
     * Returns the dimensions of the SISDCore.
     */
    public static dimensions(): { width: number, height: number } {
        return {
            width: SISDCore.IO_INTERFACE_WIDTH + ALU.dimensions().width
                + DataCellArray.dimensions(ISA.REGISTER_SIZE, 1).width + SISDCore.INNER_SPACING_L * 2,
            height: ALU.dimensions().height * 3 + SISDCore.INNER_SPACING_L * 2
        }
    }

    /**
     * Sets the core to be pipelined.
     */
    public setPipelined(): void {
        this.decoder.setPipelined();
    }

    initializeGraphics(): void {
        const ioInterfaceWidth = SISDCore.IO_INTERFACE_WIDTH;
        const aluDims = ALU.dimensions();
        const registerDims = DataCellArray.dimensions(ISA.REGISTER_SIZE, 1);
        this.height = aluDims.height * 3 + SISDCore.INNER_SPACING_L * 2;
        this.width = ioInterfaceWidth + aluDims.width + registerDims.width + SISDCore.INNER_SPACING_L * 2;

        const registerNames = new Array(ISA.REGISTER_SIZE).fill(0).map((_, i) => `R${i}`);

        this.registers = new DataCellArray(this.parent, this.position.x + this.width / 2 - registerDims.width / 2
            - SISDCore.INNER_SPACING_L - aluDims.width,
            this.position.y + this.height / 2 - aluDims.height / 2, ISA.REGISTER_SIZE,
            1, true, ISA.ZERO_REGISTER, registerNames);

        this.IOInterface = new IOInterface(this.parent, this.registers, this.workingMemory,
            this.position.x + this.width / 2 - ioInterfaceWidth / 2 - registerDims.width - SISDCore.INNER_SPACING_L * 2 - aluDims.width,
            this.position.y + this.height / 2 - aluDims.height / 2, ioInterfaceWidth, false);

        this.alu = new ALU(this.parent, this.registers, this.position.x + this.width / 2 - aluDims.width / 2,
            this.position.y + this.height / 2 - aluDims.height / 2);

        this.instructionFetcher = new InstructionFetcher(this.parent, this.position.x,
            this.position.y - this.height / 2 + aluDims.height / 2,
            this.instructionMemory.getInstructionBuffer(), this.width, this.iCache);

        this.decoder = new Decoder(this.parent, this.instructionFetcher, this.alu, this.IOInterface,
            this.position.x, this.position.y, this.width);

        this.instructionFetcher.initializeGraphics();
        this.registers.initializeGraphics();
        this.alu.initializeGraphics();
        this.IOInterface.initializeGraphics();
        this.decoder.initializeGraphics();
    }

    update() {
        this.registers.update();
        this.alu.update();
        this.IOInterface.update();
        this.decoder.update();
        this.decoder.decode();
    }
}