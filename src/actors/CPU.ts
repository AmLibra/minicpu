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
    private static readonly WORDS = 4;
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR"];
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
    private memoryAnimationPlaying = false;

    // used for computing CPU metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(20);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    // Mesh names
    private bodyMesh: string;
    private registerFileParentMesh: string;
    private fetchBufferMesh: string;
    private decodeBufferMesh: string;
    private memoryControllerMesh: string;

    constructor(position: [number, number], scene: Scene, rom: InstructionMemory, workingMemory: WorkingMemory, clockFrequency: number) {
        super(position, scene, clockFrequency)
        this.instructionMemory = rom

        this.workingMemory = workingMemory
        this.fetchBuffer = new Queue<Instruction>(CPU.fetcherCount)
        this.decodeBuffer = new Queue<Instruction>(CPU.decoderCount)
        this.ALUs = new Queue<Instruction>(CPU.aluCount)
        this.memoryController = new Queue<Instruction>(CPU.memoryControllerCount)
        this.registerValues = new Map<string, number>();

        for (let i = 0; i < CPU.REGISTER_SIZE; ++i) this.registerValues.set(this.registerName(i), 0);
        this.isPipelined = false;

        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));
        this.textMeshes.forEach(mesh => this.scene.add(mesh));

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
        this.registerFileParentMesh = "REGISTER_FILE";
        this.fetchBufferMesh = "FETCH";
        this.decodeBufferMesh = "DECODE";
        this.memoryControllerMesh = "MEMORY_CONTROLLER";

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
            this.processMemoryInstruction();
            this.processALU();
            this.decodeAll();
            this.moveInstructions(this.fetchBuffer, this.decodeBuffer, CPU.decoderCount);
            this.requestInstructionBufferRefillIfEmpty();
        } else {
            if (this.ALUs.isEmpty() && this.memoryController.isEmpty())
                this.requestInstructionBufferRefillIfEmpty();
            this.moveInstructions(this.fetchBuffer, this.decodeBuffer, CPU.decoderCount);
            this.decodeAll();
            this.processALU();
            this.processMemoryInstruction();
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

    private requestInstructionBufferRefillIfEmpty(): void {
        if (!this.fetchBuffer.isEmpty())
            return;
        if (this.instructionMemory.isReadyToBeRead())
            this.moveInstructions(this.instructionMemory.read(CPU.fetcherCount), this.fetchBuffer, CPU.fetcherCount);
        else
            this.instructionMemory.askForInstructions(this, CPU.fetcherCount);
    }

    private decodeAll(): void {
        for (let i = 0; i < CPU.decoderCount; ++i){
            const instruction = this.decodeBuffer.get(i);
            if (instruction)
                (instruction.isArithmetic() ? this.ALUs: this.memoryController)
                    .enqueue(this.decodeBuffer.dequeue())
        }
    }

    private processALU(): void {
        function computeALUResult(op1: number, op2: number, opcode: string): number {
            switch (opcode) {
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
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }

        if (!this.ALUs.isEmpty()) {
            for (let i = 0; i < CPU.aluCount; ++i) {
                const instruction = this.ALUs.get(i);
                if (!this.isPipelined)
                    this.playAluAnimation(instruction);
                this.registerValues.set(instruction.getResultReg(),
                    this.preventOverflow(computeALUResult(
                        this.registerValues.get(instruction.getOp1Reg()),
                        this.registerValues.get(instruction.getOp2Reg()),
                        instruction.getOpcode())
                    ));
                // update the text mesh
                if (!this.isPipelined){
                    this.blink(instruction.getResultReg(), CPU.ALU_COLOR);
                    this.updateRegisterTextMesh(this.registerTextMeshName(instruction.getResultReg()))
                }
                this.retiredInstructionCount++;
            }
        }
        this.ALUs.clear();
    }

    private async playAluAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = this.getClockCycleDuration() * (2 / 5);
        const delay = this.getClockCycleDuration() / 5; // 4 is the number of steps in the animation, + 1 for overlap

        this.blink(this.bufferMeshName(this.fetchBufferMesh), CPU.ALU_COLOR, blinkDuration); // step 1
        await this.delay(delay);

        this.blink(this.bufferMeshName(this.decodeBufferMesh), CPU.ALU_COLOR, blinkDuration);
        this.blink(instruction.getOp1Reg(), CPU.ALU_COLOR, blinkDuration);
        this.blink(instruction.getOp2Reg(), CPU.ALU_COLOR, blinkDuration); // step 2
        await this.delay(delay);

        this.blink(this.aluMeshName(), CPU.ALU_COLOR, blinkDuration); // step 3
        await this.delay(delay);

        this.blink(instruction.getResultReg(), CPU.ALU_COLOR, blinkDuration); // step 4
    }

    private processMemoryInstruction(): void {
        const instruction = this.memoryController.get(0);
        if (!instruction)
            return; // if there is no instruction to process, exit
        if (this.workingMemory.isReady()) {
            if (instruction.getOpcode() == "LOAD") {
                this.registerValues.set(instruction.getResultReg(), this.workingMemory.read(instruction.getAddress()));
                if (!this.isPipelined){
                    this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR);
                    this.updateRegisterTextMesh(this.registerTextMeshName(instruction.getResultReg()))
                }
            } else if (instruction.getOpcode() == "STORE")
                this.workingMemory.write(instruction.getAddress(), this.registerValues.get(instruction.getResultReg()));

            this.memoryAnimationPlaying = false;
            this.memoryController.clear();
            this.retiredInstructionCount++;
        } else {
            this.workingMemory.askForMemoryOperation(this);
            if (!this.isPipelined)
                this.playMemoryAnimation(instruction);
        }
    }

    private async playMemoryAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = this.getClockCycleDuration() * (2 / 4);
        const delay = this.getClockCycleDuration() / 4;

        if (this.memoryAnimationPlaying) {
            this.blink(this.memoryControllerMesh, CPU.MEMORY_COLOR);
            this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR);
            return;
        }

        this.blink(this.bufferMeshName(this.fetchBufferMesh), CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.blink(this.bufferMeshName(this.decodeBufferMesh), CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.blink(this.memoryControllerMesh, CPU.MEMORY_COLOR, blinkDuration);
        this.blink(instruction.getResultReg(), CPU.MEMORY_COLOR, blinkDuration);
        this.memoryAnimationPlaying = true;
    }

    private updateRetiredInstructionCounters(): void {
        if (this.previousRetiredInstructionCounts.isFull())
            this.previousRetiredInstructionCounts.dequeue();
        this.previousRetiredInstructionCounts.enqueue(this.retiredInstructionCount);
        this.accumulatedInstructionCount += this.retiredInstructionCount;
        this.retiredInstructionCount = 0;
    }

    private drawALUText(i: number): void {
        function drawALUTextComponent(key: string, text: string, xOffset: number, yOffset: number): void {
            this.textMeshes.set(key, DrawUtils.buildTextMesh(text,
                this.position.x + xOffset,
                this.position.y + yOffset, CPU.TEXT_SIZE, CPU.ALU_COLOR));
        }

        const alu = this.ALUs.get(i);
        const aluProps = this.meshProperties.get(this.aluMeshName(i));
        const distanceToCenter = 0.08;
        drawALUTextComponent(`${this.aluMeshName(i)}_OPCODE`, alu.getOpcode(), aluProps.xOffset, aluProps.yOffset);
        drawALUTextComponent(`${this.aluMeshName(i)}_OP1`, alu.getOp1Reg(),
            aluProps.xOffset + distanceToCenter, aluProps.yOffset - 0.07);
        drawALUTextComponent(`${this.aluMeshName(i)}_OP2`, alu.getOp2Reg(),
            aluProps.xOffset - distanceToCenter, aluProps.yOffset - 0.07);
        drawALUTextComponent(`${this.aluMeshName(i)}_RESULT`, alu.getResultReg(), aluProps.xOffset, aluProps.yOffset + 0.08);
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
        this.meshProperties.set(this.registerFileParentMesh, registerFile);
        this.drawRegisterGridArray(registerFile, CPU.WORDS, CPU.WORD_SIZE, CPU.INNER_SPACING)
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
        this.meshProperties.set(this.memoryControllerMesh, memoryController);
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
            this.meshProperties.set(this.aluMeshName(i), alu);
            this.scene.add(DrawUtils.buildTextMesh(this.aluMeshName(i), alu.xOffset, alu.yOffset, CPU.TEXT_SIZE, CPU.COMPONENT_COLOR));
        }
    }

    private drawCPUPins(): void {
        this.drawPins(this.meshProperties.get(this.bodyMesh), 'left', 4).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get(this.bodyMesh), 'right', InstructionMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get(this.bodyMesh), 'top', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshProperties.get(this.bodyMesh), 'bottom', CPU.POWER_PIN_COUNT).forEach((mesh, _name) => this.scene.add(mesh));
    }

    private aluMeshName(index: number = 0): string {
        return "ALU" + index;
    }

    private calculateAverageInstructionCount(): number {
        let sum = 0;
        const size = this.previousRetiredInstructionCounts.size();
        if (size === 0) return 0;

        for (let i = 0; i < size; ++i)
            sum += this.previousRetiredInstructionCounts.get(i);

        return sum / size;
    }

    private preventOverflow(n: number): number {
        const result = n % WorkingMemory.MAX_BYTE_VALUE;
        return result >= 0 ? result : result + WorkingMemory.MAX_BYTE_VALUE;
    }

    private addRegisterValueMeshes(registerName: string): void {
        this.textMeshes.set(this.registerTextMeshName(registerName), DrawUtils.buildTextMesh(this.registerValues.get(registerName).toString(),
            this.position.x + this.meshProperties.get(registerName).xOffset,
            this.position.y + this.meshProperties.get(registerName).yOffset - DrawUtils.baseTextHeight / 4,
            CPU.TEXT_SIZE, CPU.TEXT_COLOR));
    }

    private registerTextMeshName(name: string): string {
        return `${name}_CONTENT`;
    }

    private registerMeshName(name: string): string {
        return name.replace("_CONTENT", "");
    }

    private updateRegisterTextMesh(registerName: string): void {
        this.scene.remove(this.textMeshes.get(registerName));
        this.textMeshes.get(registerName).geometry.dispose();
        if (this.textMeshes.get(registerName).material instanceof Material)
            (this.textMeshes.get(registerName).material as Material).dispose();
        this.textMeshes.delete(registerName);
        this.addRegisterValueMeshes(this.registerMeshName(registerName));
        this.scene.add(this.textMeshes.get(registerName))
    }
}