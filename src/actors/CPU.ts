import {Material, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {InstructionMemory} from "./InstructionMemory";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {MeshProperties} from "../components/MeshProperties";

export class CPU extends ComputerChip {
    private static readonly INNER_SPACING_L = 0.02;
    private static readonly POWER_PIN_COUNT = 6;

    // ISA
    private static readonly WORDS = 2;
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR", "XOR", "SHL", "SHR"];
    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];
    public static readonly REGISTER_SIZE: number = CPU.WORD_SIZE * CPU.WORDS;

    private static fetcherCount: number = 1;
    private readonly fetchBuffer: Queue<Instruction>;
    private static decoderCount: number = 1;
    private readonly decodeBuffer: Queue<Instruction>;
    private static aluCount: number = 1;
    private readonly ALUs: Queue<Instruction>;
    private static memoryControllerCount: number = 1;
    private readonly memoryController: Queue<Instruction>
    private readonly registerValues: Map<string, number>;

    private readonly instructionMemory: InstructionMemory;
    private readonly workingMemory: WorkingMemory;

    private isPipelined: boolean;

    // used for computing CPU metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(20);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    // Mesh names
    private bodyMesh: string;
    private registerFileMesh: string;
    private fetchBufferMesh: string;
    private decodeBufferMesh: string;
    private ALUMesh: string;

    constructor(position: [number, number], scene: Scene, rom: InstructionMemory, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene)
        this.instructionMemory = rom
        this.workingMemory = workingMemory

        this.fetchBuffer = new Queue<Instruction>(CPU.fetcherCount)
        this.decodeBuffer = new Queue<Instruction>(CPU.decoderCount)
        this.ALUs = new Queue<Instruction>(CPU.aluCount)
        this.memoryController = new Queue<Instruction>(CPU.memoryControllerCount)
        this.registerValues = new Map<string, number>();

        for (let i = 0; i < CPU.REGISTER_SIZE; ++i) this.registerValues.set(CPU.registerName(i), 0);
        this.isPipelined = false;
        this.clockFrequency = clockFrequency;
        this.drawAllRegisterValues();
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
    }

    public setPipelined(): void {
        if (this.isPipelined)
            return;
        this.isPipelined = true;
        this.clockFrequency *= 2;
    }

    public getIPC(): string {
        return (this.calculateAverageInstructionCount()).toFixed(2);
    }

    public getIPS(): string {
        return (this.calculateAverageInstructionCount() * this.clockFrequency).toFixed(2);
    }

    public getAccumulatedInstructionCount(): number {
        return this.accumulatedInstructionCount;
    }

    computeMeshProperties(): void {
        this.bodyMesh = "CPU";
        this.registerFileMesh = "REGISTER_FILE";
        this.fetchBufferMesh = "FETCH";
        this.decodeBufferMesh = "DECODE";
        this.ALUMesh = "ALU";

        const aluWidth = 0.4;
        const registerFileWidth = CPU.WORD_SIZE * CPU.REGISTER_SIDE_LENGTH + (CPU.WORD_SIZE - 1) * CPU.INNER_SPACING;
        // noinspection JSSuspiciousNameCombination - memory controller width is the same as the height of a buffer
        const memoryControllerWidth = CPU.BUFFER_HEIGHT;
        const bodyWidth: number = registerFileWidth + aluWidth + memoryControllerWidth
            + CPU.INNER_SPACING_L * 2 + CPU.CONTENTS_MARGIN * 2;

        const fetchBufferHeight = CPU.BUFFER_HEIGHT * CPU.fetcherCount;
        const decoderHeight = CPU.BUFFER_HEIGHT * CPU.decoderCount;
        const registerFileHeight = CPU.WORDS * CPU.REGISTER_SIDE_LENGTH + (CPU.WORDS - 1) * CPU.INNER_SPACING;
        const bodyHeight: number = fetchBufferHeight + decoderHeight + registerFileHeight + 2 * CPU.INNER_SPACING_L
            + CPU.CONTENTS_MARGIN * 2;

        this.computeCPUBodyMeshProperties(bodyWidth, bodyHeight)

        const [decodeBuffer, fetchBuffer] =
            this.computeBufferMeshProperties(bodyWidth, bodyHeight, memoryControllerWidth, fetchBufferHeight, decoderHeight);

        const innerHeight = bodyHeight - (2 * CPU.CONTENTS_MARGIN);
        const registerFile = this.computeRegisterFileMeshProperties(bodyWidth, innerHeight, registerFileWidth, registerFileHeight,
            memoryControllerWidth, decodeBuffer, fetchBuffer);
        this.computeMemoryControllerMeshProperties(bodyWidth, bodyHeight, memoryControllerWidth);
        this.computeALUMeshProperties(bodyWidth, aluWidth, registerFile);
        this.drawCPUPins();

        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x, this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE + ComputerChip.PIN_RADIUS * 2,
            ComputerChip.TEXT_SIZE, CPU.HUD_TEXT_COLOR);
    }

    update() {
        if (this.isPipelined) {
            this.ALUs.clear();
            this.decodeAll();
            this.moveInstructions(this.fetchBuffer, this.decodeBuffer, CPU.decoderCount);
            this.requestInstructionBufferRefillIfEmpty();
        } else {
            if (this.blinkStates.size == 0)
                this.requestInstructionBufferRefillIfEmpty();
            this.moveInstructions(this.fetchBuffer, this.decodeBuffer, CPU.decoderCount);
            this.decodeAll();
            this.ALUs.clear();
        }
        this.updateRetiredInstructionCounters();
    }

    drawUpdate(): void {
        if (!this.isPipelined)
            return
        this.clearMutableTextMeshes();
        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));
        this.addBufferTextMeshes(this.fetchBuffer, this.fetchBufferMesh);
        this.addBufferTextMeshes(this.decodeBuffer, this.decodeBufferMesh);
        for (let i = 0; i < CPU.aluCount; ++i) this.drawALUText(i);
        this.textMeshes.forEach(comp => this.scene.add(comp));
    }

    private processALU(): void {
        if (!this.ALUs.isEmpty()) {
            for (let i = 0; i < CPU.aluCount; ++i) {
                const alu = this.ALUs.get(i);
                this.registerValues.set(alu.getResultReg(), this.preventOverflow(this.computeALUResult(alu)));
            }
        }
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

    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
    }

    private decodeAll(): void {
        for (let i = 0; i < CPU.decoderCount; ++i)
            if (this.decodeBuffer.get(i))
                this.decode(i);
    }

    private requestInstructionBufferRefillIfEmpty(): void {
        if (!this.fetchBuffer.isEmpty()) return;
        if (this.instructionMemory.isReadyToBeRead())
            this.moveInstructions(this.instructionMemory.read(CPU.fetcherCount), this.fetchBuffer, CPU.fetcherCount);
        else
            this.instructionMemory.askForInstructions(this, CPU.fetcherCount);
    }

    private async playAluAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = ComputerChip.ONE_SECOND / this.clockFrequency / this.instructionMemory.getClockFrequency();
        const delay = ComputerChip.ONE_SECOND / this.clockFrequency / 4; // 4 is the number of steps in the animation

        this.blink("FETCH_BUFFER_0", CPU.ALU_COLOR, blinkDuration);
        await this.delay(delay);

        this.blink("DECODE_BUFFER_0", CPU.ALU_COLOR, blinkDuration);
        this.blink(instruction.getOp1Reg(), CPU.ALU_COLOR, blinkDuration);
        this.blink(instruction.getOp2Reg(), CPU.ALU_COLOR, blinkDuration);
        await this.delay(delay);

        this.blink("ALU0", CPU.ALU_COLOR, blinkDuration);
        await this.delay(delay);

        this.blink(instruction.getResultReg(), CPU.ALU_COLOR, blinkDuration);
    }

    private waiting = false;

    private async playMemoryAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = ComputerChip.ONE_SECOND / this.workingMemory.getClockFrequency() / 2;
        const delay = ComputerChip.ONE_SECOND / this.clockFrequency / 3;
        if (this.waiting) {
            this.blink("MEMORY_CONTROLLER", CPU.MEMORY_COLOR,
                ComputerChip.ONE_SECOND / this.clockFrequency
            );
            if (instruction.getOpcode() == "STORE")
                this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR, blinkDuration);
            return;
        }
        this.blink("FETCH_BUFFER_0", CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.blink("DECODE_BUFFER_0", CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.blink("MEMORY_CONTROLLER", CPU.MEMORY_COLOR,
            instruction.getOpcode() == "LOAD" ? blinkDuration * 4 : blinkDuration * 4
        );
        if (instruction.getOpcode() == "STORE")
            this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR, blinkDuration);
        this.waiting = true;
    }

    private async playExtraLoadAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = ComputerChip.ONE_SECOND / this.clockFrequency;
        const delay = ComputerChip.ONE_SECOND / this.clockFrequency / 3;
        await this.delay(delay);
        this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR, blinkDuration);
        const modifiedTextMeshName = `${instruction.getResultReg()}_CONTENT`;
        this.scene.remove(this.textMeshes.get(modifiedTextMeshName));
        this.textMeshes.get(modifiedTextMeshName).geometry.dispose();
        if (this.textMeshes.get(modifiedTextMeshName).material instanceof Material)
            (this.textMeshes.get(modifiedTextMeshName).material as Material).dispose();
        this.textMeshes.delete(modifiedTextMeshName);
        this.drawRegisterValue(modifiedTextMeshName);
        this.scene.add(this.textMeshes.get(modifiedTextMeshName));
    }

    private drawRegisterValue(modifiedTextMeshName: string): void {
        const register = modifiedTextMeshName.replace("_CONTENT", "")
        this.textMeshes.set(modifiedTextMeshName, DrawUtils.buildTextMesh(this.registerValues.get(register).toString(),
            this.position.x + this.meshProperties.get(register).xOffset,
            this.position.y + this.meshProperties.get(register).yOffset - DrawUtils.baseTextHeight / 4,
            CPU.TEXT_SIZE, CPU.TEXT_COLOR));
    }

    private drawAllRegisterValues(): void {
        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));
        this.textMeshes.forEach(mesh => this.scene.add(mesh));
    }

    private decode(index: number): void {
        const instruction = this.decodeBuffer.get(index);
        if (instruction.isArithmetic()) {
            this.ALUs.enqueue(this.decodeBuffer.dequeue())
            this.retiredInstructionCount++;
            this.processALU();
            if (!this.isPipelined)
                this.playAluAnimation(instruction);
            return;
        } else if (instruction.isMemoryOperation()) {
            if (this.workingMemory.isReady()) {
                if (instruction.getOpcode() == "LOAD") {
                    this.registerValues.set(instruction.getResultReg(), this.workingMemory.read(instruction.getAddress()));
                    if (!this.isPipelined)
                        this.playExtraLoadAnimation(instruction)
                } else if (instruction.getOpcode() == "STORE")
                    this.workingMemory.write(instruction.getAddress(), this.registerValues.get(instruction.getResultReg()));
                this.decodeBuffer.dequeue()
                this.waiting = false;
                this.retiredInstructionCount++;
            } else {
                this.workingMemory.askForMemoryOperation(this);
                if (!this.isPipelined)
                    this.playMemoryAnimation(instruction);
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
                CPU.TEXT_SIZE, CPU.TEXT_COLOR));
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
            this.position.y + yOffset, CPU.TEXT_SIZE, CPU.ALU_COLOR));
    }

    private computeCPUBodyMeshProperties(bodyWidth: number, bodyHeight: number): void {
        const cpuBody = {
            width: bodyWidth,
            height: bodyHeight,
            xOffset: 0,
            yOffset: 0,
            color: CPU.BODY_COLOR,
        };
        this.meshProperties.set(this.bodyMesh, cpuBody);
    }

    private computeBufferMeshProperties(bodyWidth: number, bodyHeight: number, memoryControllerWidth: number,
                                        fetchBufferHeight: number, decoderHeight: number): MeshProperties[] {
        const innerWidth = bodyWidth - (2 * CPU.CONTENTS_MARGIN);
        const innerHeight = bodyHeight - (2 * CPU.CONTENTS_MARGIN);
        const bufferWidth = innerWidth - memoryControllerWidth - CPU.INNER_SPACING_L;

        const fetchBuffer = {
            width: bufferWidth, // Use the full inner width
            height: fetchBufferHeight,
            xOffset: 2 * CPU.CONTENTS_MARGIN + memoryControllerWidth + (bufferWidth / 2) - (bodyWidth / 2) -
                CPU.INNER_SPACING,
            yOffset: -(innerHeight / 2) + (fetchBufferHeight / 2), // Positioned at the top
            color: CPU.COMPONENT_COLOR,
        };
        this.drawBuffer(this.fetchBufferMesh, fetchBuffer, CPU.fetcherCount, 0, CPU.INNER_SPACING_L / 2,
            CPU.COMPONENT_COLOR, true);
        this.scene.add(DrawUtils.buildTextMesh(this.fetchBufferMesh, fetchBuffer.xOffset, fetchBuffer.yOffset, CPU.TEXT_SIZE,
            CPU.COMPONENT_COLOR));

        const decodeBuffer = {
            width: bufferWidth,
            height: decoderHeight,
            xOffset: 2 * CPU.CONTENTS_MARGIN + memoryControllerWidth + (bufferWidth / 2) - (bodyWidth / 2) -
                CPU.INNER_SPACING,
            yOffset: fetchBuffer.yOffset + (fetchBuffer.height / 2) + CPU.INNER_SPACING_L + (decoderHeight / 2),
            color: CPU.COMPONENT_COLOR,
        };
        this.drawBuffer(this.decodeBufferMesh, decodeBuffer, CPU.decoderCount, 0, CPU.INNER_SPACING_L / 2,
            CPU.COMPONENT_COLOR, true);
        this.scene.add(DrawUtils.buildTextMesh(this.decodeBufferMesh, decodeBuffer.xOffset, decodeBuffer.yOffset,
            CPU.TEXT_SIZE, CPU.COMPONENT_COLOR));

        return [decodeBuffer, fetchBuffer];
    }

    private computeRegisterFileMeshProperties(bodyWidth: number, innerHeight: number, registerFileWidth: number, registerFileHeight: number, memoryControllerWidth: number,
                                              decodeBuffer: MeshProperties, fetchBuffer: MeshProperties): MeshProperties {
        const registerFile = {
            width: registerFileWidth,
            height: registerFileHeight,
            xOffset: 2 * CPU.CONTENTS_MARGIN + (registerFileWidth / 2) - (bodyWidth / 2) + memoryControllerWidth -
                CPU.INNER_SPACING,
            yOffset: decodeBuffer.yOffset + decodeBuffer.height / 2 + CPU.INNER_SPACING_L +
                (innerHeight - fetchBuffer.height - decodeBuffer.height - 2 * CPU.INNER_SPACING_L) / 2,
            color: CPU.BODY_COLOR,
        };
        this.meshProperties.set(this.registerFileMesh, registerFile);
        this.drawGrid(registerFile, CPU.WORDS, CPU.WORD_SIZE, CPU.INNER_SPACING)
            .forEach((dimensions, name) => {
                this.scene.add(DrawUtils.buildTextMesh(name,
                    this.position.x + dimensions.xOffset,
                    this.position.y + dimensions.yOffset + dimensions.height / 2 - DrawUtils.baseTextHeight / 4,
                    CPU.TEXT_SIZE / 2, CPU.BODY_COLOR));
            });
        return registerFile;
    }

    private computeMemoryControllerMeshProperties(bodyWidth: number, bodyHeight: number, memoryControllerWidth: number): void {
        const memoryController = {
            width: memoryControllerWidth,
            height: bodyHeight - CPU.CONTENTS_MARGIN * 2,
            xOffset: -bodyWidth / 2 + memoryControllerWidth / 2 + CPU.CONTENTS_MARGIN,
            yOffset: 0,
            color: CPU.COMPONENT_COLOR
        }
        this.meshProperties.set("MEMORY_CONTROLLER", memoryController);
        const memoryMesh = DrawUtils.buildTextMesh("MEMORY",
            memoryController.xOffset,
            memoryController.yOffset, CPU.TEXT_SIZE, CPU.COMPONENT_COLOR);
        memoryMesh.geometry.center().rotateZ(Math.PI / 2);
        memoryMesh.position.set(memoryController.xOffset, memoryController.yOffset, 0)
        this.scene.add(memoryMesh);
    }

    private computeALUMeshProperties(bodyWidth: number, aluWidth: number, registerFile: MeshProperties): void {
        const aluHeight = CPU.REGISTER_SIDE_LENGTH * 2 + CPU.INNER_SPACING;
        for (let i = 0; i < CPU.aluCount; ++i) {
            const alu = {
                width: aluWidth,
                height: aluHeight,
                xOffset: bodyWidth / 2 - aluWidth / 2 - CPU.CONTENTS_MARGIN,
                yOffset: registerFile.yOffset + (i % 2 == 0 ? -1 : 1) * (registerFile.height / 2 - aluHeight / 2),
                color: CPU.COMPONENT_COLOR
            };
            this.meshProperties.set("ALU" + i, alu);
            this.scene.add(DrawUtils.buildTextMesh(this.ALUMesh + i, alu.xOffset, alu.yOffset, CPU.TEXT_SIZE, CPU.COMPONENT_COLOR));
        }
    }

    private drawCPUPins(): void {
        this.drawPins(this.meshProperties.get("CPU"), 'left', 4).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'right', InstructionMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'top', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get("CPU"), 'bottom', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
    }

    public static registerName(address: number): string {
        if (address >= CPU.REGISTER_SIZE)
            throw new Error("Invalid register address: " + address);
        return `R${address}`;
    }

    private calculateAverageInstructionCount(): number {
        let sum = 0;
        const size = this.previousRetiredInstructionCounts.size();
        if (size === 0) return 0;

        for (let i = 0; i < size; ++i) {
            sum += this.previousRetiredInstructionCounts.get(i);
        }
        return sum / size;
    }

    private preventOverflow(n: number): number {
        const result = n % WorkingMemory.MAX_BYTE_VALUE;
        return result >= 0 ? result : result + WorkingMemory.MAX_BYTE_VALUE;
    }
}