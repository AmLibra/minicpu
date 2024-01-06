import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";

export class CPU extends ComputerChip {
    private static readonly BUFFER_HEIGHT: number = 0.12;
    private static readonly REGISTER_SIDE_LENGTH: number = 0.15;
    private static readonly REGISTER_FILE_MARGIN = 0.01;
    private static readonly POWER_PIN_COUNT = 8;

    public static clockFrequency: number = 1; // Hz
    public readonly rom: InstructionMemory;
    public readonly mainMemory: WorkingMemory;

    public static readonly FETCHER_COUNT: number = 1; // Words
    private readonly instructionBuffer: Queue<Instruction>;

    public static DECODER_COUNT: number = 1;
    private readonly decoders: Queue<Instruction>;

    private static readonly REGISTER_FILE_ROW_COUNT = 2;
    private static readonly REGISTER_FILE_COL_COUNT = 4;

    public static readonly REGISTER_SIZE: number = CPU.REGISTER_FILE_COL_COUNT * CPU.REGISTER_FILE_ROW_COUNT;
    public static readonly REGISTER_NAMES = [];
    static {
        for (let i = 0; i < CPU.REGISTER_SIZE; i++) this.REGISTER_NAMES.push(`R${i}`)
    }

    public static readonly ALU_COUNT: number = 1;
    private readonly ALUs: Queue<Instruction>;
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR", "XOR", "SHL", "SHR"];
    public static readonly ALU_WIDTH = 0.4;
    public static readonly ALU_HEIGHT = CPU.REGISTER_SIDE_LENGTH * 2 + CPU.REGISTER_FILE_MARGIN;

    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];

    private readonly registerValues: Map<string, number>;
    private isPipelined: boolean;

    private previouslyDecodedInstructionIsArithmetic: boolean = false;
    private nonPipelinedDisplayLatency: boolean = false;

    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(WorkingMemory.MEMORY_OPERATION_DELAY * 5);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    private static readonly COMPONENTS_INNER_MARGIN = 0.03;
    private static readonly COMPONENTS_SPACING = 0.02;
    private static readonly FETCH_BUFFER_HEIGHT = CPU.BUFFER_HEIGHT * CPU.FETCHER_COUNT;
    private static readonly DECODER_HEIGHT = CPU.BUFFER_HEIGHT * CPU.DECODER_COUNT;
    private static readonly REGISTER_FILE_WIDTH = CPU.REGISTER_FILE_COL_COUNT * CPU.REGISTER_SIDE_LENGTH +
        (CPU.REGISTER_FILE_COL_COUNT - 1) * CPU.REGISTER_FILE_MARGIN;
    private static readonly REGISTER_FILE_HEIGHT = CPU.REGISTER_FILE_ROW_COUNT * CPU.REGISTER_SIDE_LENGTH
        + (CPU.REGISTER_FILE_ROW_COUNT - 1) * CPU.REGISTER_FILE_MARGIN;
    private static readonly WIDTH: number = CPU.REGISTER_FILE_WIDTH + CPU.ALU_WIDTH + CPU.COMPONENTS_SPACING +
        CPU.COMPONENTS_INNER_MARGIN * 2;
    private static readonly HEIGHT: number = CPU.FETCH_BUFFER_HEIGHT + CPU.DECODER_HEIGHT +
        CPU.REGISTER_FILE_HEIGHT + 2 * CPU.COMPONENTS_SPACING + CPU.COMPONENTS_INNER_MARGIN * 2;

    constructor(id: string, position: [number, number], scene: Scene, rom: InstructionMemory, mainMemory: WorkingMemory) {
        super(id, position, scene)
        this.rom = rom
        this.mainMemory = mainMemory

        this.instructionBuffer = new Queue<Instruction>(CPU.FETCHER_COUNT)
        this.decoders = new Queue<Instruction>(CPU.DECODER_COUNT)
        this.ALUs = new Queue<Instruction>(CPU.ALU_COUNT)
        this.registerValues = new Map<string, number>();

        CPU.REGISTER_NAMES.forEach(name => this.registerValues.set(name, 0));
        this.isPipelined = false;
    }

    computeMeshProperties(): void {
        const cpuBody = {
            width: CPU.WIDTH,
            height: CPU.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: CPU.COLORS.get("BODY"),
            immutable: true
        };

        const innerWidth = CPU.WIDTH - (2 * CPU.COMPONENTS_INNER_MARGIN);
        const innerHeight = CPU.HEIGHT - (2 * CPU.COMPONENTS_INNER_MARGIN);

        const fetchBuffer = {
            width: innerWidth, // Use the full inner width
            height: CPU.FETCH_BUFFER_HEIGHT,
            xOffset: this.position.x, // Centered horizontally
            yOffset: -(innerHeight / 2) + (CPU.FETCH_BUFFER_HEIGHT / 2), // Positioned at the top
            color: CPU.COLORS.get("COMPONENT"),
            immutable: true
        };

        const decoder = {
            width: fetchBuffer.width, // Match the width of the instruction buffer
            height: CPU.DECODER_HEIGHT,
            xOffset: this.position.x, // Centered horizontally
            yOffset: fetchBuffer.yOffset + (fetchBuffer.height / 2) + CPU.COMPONENTS_SPACING
                + (CPU.DECODER_HEIGHT / 2), // Positioned below the instruction buffer
            color: CPU.COLORS.get("COMPONENT"),
            immutable: true
        };

        const registerFile = {
            width: CPU.REGISTER_FILE_WIDTH,
            height: CPU.REGISTER_FILE_HEIGHT,
            xOffset: CPU.COMPONENTS_INNER_MARGIN + (CPU.REGISTER_FILE_WIDTH / 2) - (CPU.WIDTH / 2),
            yOffset: decoder.yOffset + decoder.height / 2 + CPU.COMPONENTS_SPACING +
                (innerHeight - fetchBuffer.height - decoder.height - 2 * CPU.COMPONENTS_SPACING) / 2,
            color: CPU.COLORS.get("BODY"),
            immutable: true
        };

        this.meshProperties = new Map([
            ["CPU", cpuBody],
            ["REGISTER_FILE", registerFile],
        ]);

        for (let i = 0; i < CPU.ALU_COUNT; ++i) {
            const alu = {
                width: CPU.ALU_WIDTH,
                height: CPU.ALU_HEIGHT,
                xOffset: CPU.WIDTH / 2 - CPU.COMPONENTS_INNER_MARGIN - CPU.ALU_WIDTH / 2, // single column for now
                yOffset: registerFile.yOffset + (i % 2 == 0 ? -1 : 1) * (registerFile.height / 2 - CPU.ALU_HEIGHT / 2),
                color: CPU.COLORS.get("COMPONENT"),
                immutable: true
            };
            this.meshProperties.set("ALU" + i, alu);
        }

        this.drawBuffer("FETCH", fetchBuffer, CPU.FETCHER_COUNT,
            0, CPU.COMPONENTS_SPACING / 2, CPU.COLORS.get("COMPONENT"), true);

        this.drawBuffer("DECODER", decoder, CPU.DECODER_COUNT, 0, CPU.COMPONENTS_SPACING / 2,
            CPU.COLORS.get("COMPONENT"), true);

        this.drawGrid(registerFile, CPU.REGISTER_FILE_ROW_COUNT, CPU.REGISTER_FILE_COL_COUNT, CPU.REGISTER_FILE_MARGIN)
            .forEach((dimensions, name) => {
                this.scene.add(DrawUtils.buildTextMesh(name,
                    this.position.x + dimensions.xOffset,
                    this.position.y + dimensions.yOffset + dimensions.height / 2 - DrawUtils.baseTextHeight / 4,
                    CPU.TEXT_SIZE / 2, CPU.COLORS.get("BODY")));
            });

        this.drawPins(this.meshProperties.get("CPU"), 'left', WorkingMemory.ROW_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'right', InstructionMemory.MEMORY_SIZE).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'top', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'bottom', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
    }

    update() {
        if (this.isPipelined) {
            if (!this.ALUs.isEmpty())
                this.retireALUInstructions();
            this.decodeAll();
            this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
        } else {
            this.moveInstructions(this.instructionBuffer, this.decoders, CPU.DECODER_COUNT);
            this.decodeAll();
            if (!this.ALUs.isEmpty())
                this.retireALUInstructions();
        }
        this.requestInstructionBufferRefillIfEmpty();
        this.updateRetiredInstructionCounters();
    }

    drawUpdate(): void {
        this.clearMutableTextMeshes( !this.isPipelined && !this.nonPipelinedDisplayLatency
        && this.previouslyDecodedInstructionIsArithmetic ? "FETCH_BUFFER_0" : undefined);
        this.nonPipelinedDisplayLatency = !this.nonPipelinedDisplayLatency;
        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));
        this.addBufferTextMeshes(this.instructionBuffer, "FETCH");
        this.addBufferTextMeshes(this.decoders, "DECODER");
        for (let i = 0; i < CPU.ALU_COUNT; ++i)
            this.drawALUText(i);

        this.textMeshes.forEach(comp => this.scene.add(comp));
    }

    public setPipelined(): void {
        if (CPU.ALU_COUNT >= 1 && CPU.DECODER_COUNT >= 1) {
            this.isPipelined = true;
            CPU.clockFrequency *= 2;
        }  else {
            throw new Error("Cannot set CPU to pipelined mode with current configuration");
        }
    }

    public getIPC(): string {
        let sum = 0;
        for (let i = 0; i < this.previousRetiredInstructionCounts.size(); ++i)
            sum += this.previousRetiredInstructionCounts.get(i);
        return (sum / this.previousRetiredInstructionCounts.size()).toFixed(2);
    }

    public getAccumulatedInstructionCount(): number {
        return this.accumulatedInstructionCount;
    }

    private processALU(): void {
        if (!this.ALUs.isEmpty()) {
            for (let i = 0; i < CPU.ALU_COUNT; ++i) {
                const alu = this.ALUs.get(i);
                this.registerValues.set(alu.getResultReg(), this.preventOverflow(this.computeALUResult(alu)));
                this.blink(alu.getResultReg(), CPU.COLORS.get("ALU"));
                this.blink(alu.getOp1Reg(), CPU.COLORS.get("ALU"));
                this.blink(alu.getOp2Reg(), CPU.COLORS.get("ALU"));
            }
        }
    }

    private retireALUInstructions(): void {
        this.ALUs.clear();
        this.previouslyDecodedInstructionIsArithmetic = true;
    }

    private computeALUResult(alu: Instruction): number {
        const op1 = this.registerValues.get(alu.getOp1Reg());
        const op2 = this.registerValues.get(alu.getOp2Reg());
        switch (alu.getOpcode()) {
            case "ADD":
                return op1 + op2;
            case "SUB":
                return op1 - op2;
            case "MUL":
                return op1 * op2;
            case "AND":
                return op1 & op2;
            case "OR":
                return op1 | op2;
            case "XOR":
                return op1 ^ op2;
            case "SHL":
                return op1 << op2;
            case "SHR":
                return op1 >> op2;
            default:
                throw new Error("Invalid ALU opcode: " + alu.getOpcode());
        }
    }

    private preventOverflow(n: number): number {
        const result = n % WorkingMemory.MAX_VALUE;
        return result >= 0 ? result : result + WorkingMemory.MAX_VALUE;
    }

    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
    }

    private decodeAll(): void {
        for (let i = 0; i < CPU.DECODER_COUNT; ++i)
            if (this.decoders.get(i))
                this.decode(i);
    }

    private requestInstructionBufferRefillIfEmpty(): void {
        if (!this.instructionBuffer.isEmpty()) return;
        if (this.rom.readyToBeRead)
            this.moveInstructions(this.rom.read(CPU.FETCHER_COUNT), this.instructionBuffer, CPU.FETCHER_COUNT);
        else
            this.rom.askForInstructions();
    }

    private decode(index: number): void {
        const instruction = this.decoders.get(index);
        this.previouslyDecodedInstructionIsArithmetic = false;
        if (instruction.isArithmetic()) {
            this.ALUs.enqueue(this.decoders.dequeue())
            this.retiredInstructionCount++;
            this.processALU();
            if (!this.isPipelined) {
                this.blink("DECODER_BUFFER_0", CPU.COLORS.get("ALU"));
                this.blink("ALU0", CPU.COLORS.get("ALU"));
            }
            return;
        } else if (instruction.isMemoryOperation()) {
            if (this.mainMemory.readyToExecuteMemoryOperation) {
                if (instruction.getOpcode() == "LOAD")
                    this.registerValues.set(instruction.getResultReg(), this.mainMemory.read(instruction.getAddress()));
                else if (instruction.getOpcode() == "STORE")
                    this.mainMemory.write(instruction.getAddress(), this.registerValues.get(instruction.getResultReg()));
                this.blink(instruction.getResultReg(), CPU.COLORS.get("MEMORY"));

                this.decoders.dequeue()
                this.retiredInstructionCount++;
            } else {
                this.mainMemory.askForMemoryOperation(instruction.getAddress());
                this.blink(instruction.getResultReg(), CPU.COLORS.get("MEMORY"));

            }
        } else {
            throw new Error("Invalid instruction: " + instruction.toString());
        }
    }

    private addRegisterValueMeshes(registerName: string): void {
        this.textMeshes.set(registerName + "_CONTENT",
            DrawUtils.buildTextMesh(this.registerValues.get(registerName).toString(),
                this.position.x + this.meshProperties.get(registerName).xOffset,
                this.position.y + this.meshProperties.get(registerName).yOffset - DrawUtils.baseTextHeight / 4,
                CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }

    private drawALUText(i: number): void {
        const alu = this.ALUs.get(0);
        if (!alu) return;
        const aluProps = this.meshProperties.get("ALU" + i);
        const distanceToCenter = 0.08;
        this.drawALUTextComponent("ALU_OP", alu.getOpcode(), aluProps.xOffset, aluProps.yOffset);
        this.drawALUTextComponent("ALU_OP1", alu.getOp1Reg(),
            aluProps.xOffset + distanceToCenter, aluProps.yOffset - 0.07);
        this.drawALUTextComponent("ALU_OP2", alu.getOp2Reg(),
            aluProps.xOffset - distanceToCenter, aluProps.yOffset - 0.07);
        this.drawALUTextComponent("ALU_RESULT", alu.getResultReg(), aluProps.xOffset, aluProps.yOffset + 0.08);
    }

    private drawALUTextComponent(key: string, text: string, xOffset: number, yOffset: number): void {
        this.textMeshes.set(key, DrawUtils.buildTextMesh(text,
            this.position.x + xOffset,
            this.position.y + yOffset, CPU.TEXT_SIZE, CPU.COLORS.get("TEXT")));
    }
}