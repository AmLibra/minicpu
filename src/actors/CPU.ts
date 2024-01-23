import {Mesh, PlaneGeometry, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {ComputerChip} from "./ComputerChip";
import {Instruction} from "../components/Instruction";
import {RAM} from "./RAM";
import {WorkingMemory} from "./WorkingMemory";
import {Queue} from "../components/Queue";
import {MeshProperties} from "../components/MeshProperties";
import {Counter} from "./Counter";

export class CPU extends ComputerChip {
    private static readonly INNER_SPACING_L = 0.02;
    private static readonly POWER_PIN_COUNT = 6;

    // ISA
    private static readonly WORDS = 1;
    public static readonly ALU_OPCODES = ["ADD", "SUB", "MUL", "AND", "OR"];
    public static readonly MEMORY_OPCODES = ["LOAD", "STORE"];
    public static readonly REGISTER_SIZE: number = CPU.WORD_SIZE * CPU.WORDS;

    private static superScalarFactor: number = 1;
    private counter: Counter;
    private static fetcherCount: number = CPU.superScalarFactor;
    private readonly fetchBuffer: Queue<Instruction>;
    private static decoderCount: number = CPU.superScalarFactor;
    private readonly decodeBuffer: Queue<Instruction>;
    private static aluCount: number = CPU.superScalarFactor;
    private readonly ALUs: Queue<Instruction>;
    private static memoryControllerCount: number = 1;
    private readonly memoryController: Queue<Instruction>
    private readonly registerValues: Map<string, number>;

    private readonly instructionMemory: RAM;
    private readonly workingMemory: WorkingMemory;

    private isPipelined: boolean;
    private memoryAnimationPlaying = false;

    // used for computing CPU metrics
    private previousRetiredInstructionCounts: Queue<number> = new Queue<number>(30);
    private retiredInstructionCount: number = 0;
    private accumulatedInstructionCount: number = 0;

    // Mesh names
    private registerFileParentMesh: string;
    private fetchBufferMesh: string;
    private decodeBufferMesh: string;
    private memoryControllerMesh: string;

    constructor(position: [number, number], scene: Scene, rom: RAM, workingMemory: WorkingMemory, clockFrequency: number) {
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

        this.initGraphics();
        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));

        this.counter = new Counter(this, -0.25, -0.2);
        this.counter.initializeGraphics();


        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
        this.drawCPUPins();

        this.drawRightTraces(0.2, 0.02);
        this.drawBottomTraces(0.05, 0.02);
    }

    private drawBottomTraces(baseOffset: number, distanceBetweenPins: number): void {
        const halfwayWorkingMem = this.findMatchingWidth(this.workingMemory.size / 2, 'bottom')
        for (let i = 0; i < halfwayWorkingMem; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'bottom')),
                'bottom', this.workingMemory.getPinPosition(i, 'top'), 'top',
                baseOffset + (distanceBetweenPins * i)));
        }
        for (let i = halfwayWorkingMem; i < this.workingMemory.size; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'bottom')),
                'bottom', this.workingMemory.getPinPosition(i, 'top'), 'top',
                baseOffset + (distanceBetweenPins * (halfwayWorkingMem + 1)) - (distanceBetweenPins * (i - halfwayWorkingMem))));
        }
    }

    private drawRightTraces(baseOffset: number, distanceBetweenPins: number): void {
        const halfwayInstructionMem = this.findMatchingHeight(this.instructionMemory.size / 2, 'right')
        for (let i = 0; i < halfwayInstructionMem; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'right')),
                'right', this.instructionMemory.getPinPosition(i, 'left'), 'left',
                baseOffset + (distanceBetweenPins * i)));
        }
        for (let i = halfwayInstructionMem; i < this.instructionMemory.size; ++i) {
            this.scene.add(this.buildTrace(this.pinPositions.get(this.pinName(i, 'right')),
                'right', this.instructionMemory.getPinPosition(i, 'left'), 'left',
                baseOffset + (distanceBetweenPins * halfwayInstructionMem) - (distanceBetweenPins * (i - halfwayInstructionMem))));
        }
    }


    private findMatchingHeight(pin: number, side: "left" | "right" | "top" | "bottom"): number {
        const pinPositionY = this.pinPositions.get(this.pinName(pin, side)).y;
        let closest = 0;
        for (let i = 0; i < this.instructionMemory.size; ++i) {
            const instructionPositionY = this.instructionMemory.getPinPosition(i, 'left').y;
            if (Math.abs(instructionPositionY - pinPositionY) < Math.abs(
                this.instructionMemory.getPinPosition(closest, 'left').y - pinPositionY)) {
                closest = i;
            }
        }
        return closest;
    }


    private findMatchingWidth(pin: number, side: "left" | "right" | "top" | "bottom"): number {
        const pinPositionX = this.pinPositions.get(this.pinName(pin, side)).x;
        let closest = 0;
        for (let i = 0; i < this.workingMemory.size; ++i) {
            const instructionPositionX = this.workingMemory.getPinPosition(i, 'top').x;
            if (Math.abs(instructionPositionX - pinPositionX) < Math.abs(
                this.workingMemory.getPinPosition(closest, 'top').x - pinPositionX)) {
                closest = i;
            }
        }
        return closest;
    }

    public setPipelined(): void {
        if (this.isPipelined)
            return;
        this.isPipelined = true;
        this.clockFrequency *= 2;
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
    }

    public getIPC(): string {
        return (this.calculateAverageInstructionCount()).toFixed(2);
    }

    public getIPS(): string {
        return (this.calculateAverageInstructionCount() * this.clockFrequency).toFixed(2);
    }

    public getAccRetiredInstructionsCount(): number {
        return this.accumulatedInstructionCount;
    }

    displayName(): string {
        return "CPU";
    }

    computeMeshProperties(): void {
        this.bodyMeshName = "CPU";
        this.registerFileParentMesh = "REGISTER_FILE";
        this.fetchBufferMesh = "FETCH";
        this.decodeBufferMesh = "DECODE";
        this.memoryControllerMesh = "MEMORY_CONTROLLER";

        const aluWidth = 0.3;
        const registerFileWidth = CPU.WORD_SIZE * CPU.REGISTER_SIDE_LENGTH + (CPU.WORD_SIZE - 1) * CPU.INNER_SPACING;
        // noinspection JSSuspiciousNameCombination - memory controller width is the same as the height of a buffer
        const memoryControllerWidth = CPU.BUFFER_HEIGHT;
        const bodyWidth: number = registerFileWidth + aluWidth + memoryControllerWidth
            + CPU.INNER_SPACING_L * 2 + CPU.CONTENTS_MARGIN * 2;

        const fetchBufferHeight = CPU.BUFFER_HEIGHT * CPU.fetcherCount;
        const decoderHeight = CPU.BUFFER_HEIGHT * CPU.decoderCount;
        const registerFileHeight = CPU.WORDS * CPU.REGISTER_SIDE_LENGTH + (CPU.WORDS - 1) * CPU.INNER_SPACING;
        const bodyHeight: number = fetchBufferHeight + decoderHeight + registerFileHeight + (CPU.WORDS > 1 ? 2 : 4) * CPU.INNER_SPACING_L
            + CPU.CONTENTS_MARGIN * 2;

        this.bodyMesh = new Mesh(new PlaneGeometry(bodyWidth, bodyHeight), WorkingMemory.BODY_COLOR);

        this.computeCPUBodyMeshProperties(bodyWidth, bodyHeight)

        const [decodeBuffer, fetchBuffer] =
            this.computeBufferMeshProperties(bodyWidth, bodyHeight, memoryControllerWidth, fetchBufferHeight, decoderHeight);

        const innerHeight = bodyHeight - (2 * CPU.CONTENTS_MARGIN);
        const registerFile = this.computeRegisterFileMeshProperties(bodyWidth, innerHeight, registerFileWidth, registerFileHeight,
            memoryControllerWidth, decodeBuffer, fetchBuffer);
        this.computeMemoryControllerMeshProperties(bodyWidth, bodyHeight, memoryControllerWidth);
        this.computeALUMeshProperties(bodyWidth, aluWidth, registerFile);

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
        this.clearTextMeshes();
        this.registerValues.forEach((_value, registerName) => this.addRegisterValueMeshes(registerName));
        this.addBufferTextMeshes(this.fetchBuffer, this.fetchBufferMesh);
        this.addBufferTextMeshes(this.decodeBuffer, this.decodeBufferMesh);
        this.addVerticalBufferTextMeshes(this.memoryController, this.memoryControllerMesh);
        for (let i = 0; i < CPU.aluCount; ++i) this.drawALUText(i);
        this.textMeshNames.forEach(comp => this.scene.add(this.meshes.get(comp)));
    }

    private requestInstructionBufferRefillIfEmpty(): void {
        if (this.fetchBuffer.isFull())
            return;
        if (this.instructionMemory.isReadyToBeRead()){
            this.moveInstructions(this.instructionMemory.read(CPU.fetcherCount), this.fetchBuffer, CPU.fetcherCount);
            this.counter.update();
        }
        else
            this.instructionMemory.askForInstructions(this, CPU.fetcherCount);
    }

    private decodeAll(): void {
        for (let i = 0; i < CPU.decoderCount; ++i) {
            const instruction = this.decodeBuffer.get(i);
            const executePipelineEmpty = this.ALUs.isEmpty() && this.memoryController.isEmpty();

            if (instruction && executePipelineEmpty) {
                if (instruction.isArithmetic())
                    this.ALUs.enqueue(this.decodeBuffer.dequeue());
                else if (instruction.isMemoryOperation())
                    this.memoryController.enqueue(this.decodeBuffer.dequeue());
            }
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
                if (!instruction)
                    continue;
                if (!this.isPipelined)
                    this.playAluAnimation(instruction).catch(reason => console.error(reason));
                else {
                    this.highlight(instruction.getOp1Reg(), CPU.ALU_COLOR);
                    this.highlight(instruction.getOp2Reg(), CPU.ALU_COLOR);
                    this.highlight(instruction.getResultReg(), CPU.ALU_COLOR);
                }
                this.registerValues.set(instruction.getResultReg(),
                    this.preventOverflow(computeALUResult(
                        this.registerValues.get(instruction.getOp1Reg()),
                        this.registerValues.get(instruction.getOp2Reg()),
                        instruction.getOpcode())
                    ));
                DrawUtils.updateText(this.meshes.get(this.registerTextMeshName(instruction.getResultReg())),
                    this.registerValues.get(instruction.getResultReg()).toString());

                this.retiredInstructionCount++;
            }
        }
        this.ALUs.clear();
    }

    private async playAluAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = this.getClockCycleDuration() * (2 / 5);
        const delay = this.getClockCycleDuration() / 5; // 4 is the number of steps in the animation, + 1 for overlap

        this.highlight(this.bufferMeshName(this.fetchBufferMesh), CPU.ALU_COLOR, blinkDuration); // step 1
        await this.delay(delay);

        this.highlight(this.bufferMeshName(this.decodeBufferMesh), CPU.ALU_COLOR, blinkDuration);
        this.highlight(instruction.getOp1Reg(), CPU.ALU_COLOR, blinkDuration);
        this.highlight(instruction.getOp2Reg(), CPU.ALU_COLOR, blinkDuration); // step 2
        await this.delay(delay);

        this.highlight(this.aluMeshName(), CPU.ALU_COLOR, blinkDuration); // step 3
        await this.delay(delay);

        this.highlight(instruction.getResultReg(), CPU.ALU_COLOR, blinkDuration); // step 4
    }

    private processMemoryInstruction(): void {
        const instruction = this.memoryController.get(0);
        if (!instruction)
            return; // if there is no instruction to process, exit
        if (this.workingMemory.isReady(instruction.getAddress())) {
            if (instruction.getOpcode() == "LOAD") {
                this.registerValues.set(instruction.getResultReg(), this.workingMemory.read(instruction.getAddress()));
                this.highlight(instruction.getResultReg(), CPU.MEMORY_COLOR);
                DrawUtils.updateText(this.meshes.get(this.registerTextMeshName(instruction.getResultReg())),
                    this.registerValues.get(instruction.getResultReg()).toString());
            } else if (instruction.getOpcode() == "STORE")
                this.workingMemory.write(instruction.getAddress(), this.registerValues.get(instruction.getResultReg()));

            this.memoryAnimationPlaying = false;
            this.memoryController.clear();
            this.retiredInstructionCount++;
        } else {
            this.workingMemory.askForMemoryOperation(this, instruction.getAddress());
            if (!this.isPipelined)
                this.playMemoryAnimation(instruction).catch(reason => console.error(reason));
            else
                this.highlight(instruction.getResultReg(), CPU.MEMORY_COLOR);
        }
    }

    private async playMemoryAnimation(instruction: Instruction): Promise<void> {
        const blinkDuration = this.getClockCycleDuration() * (2 / 4);
        const delay = this.getClockCycleDuration() / 4;

        if (this.memoryAnimationPlaying) {
            this.highlight(this.memoryControllerMesh, CPU.MEMORY_COLOR);
            this.highlight(instruction.getResultReg(), CPU.MEMORY_COLOR);
            return;
        }

        this.highlight(this.bufferMeshName(this.fetchBufferMesh), CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.highlight(this.bufferMeshName(this.decodeBufferMesh), CPU.MEMORY_COLOR, blinkDuration);
        await this.delay(delay);
        this.highlight(this.memoryControllerMesh, CPU.MEMORY_COLOR, blinkDuration);
        this.highlight(instruction.getResultReg(), CPU.MEMORY_COLOR, blinkDuration);
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
        const drawALUTextComponent = (meshName: string, text: string, xOffset: number, yOffset: number): void => {
            const mesh = DrawUtils.buildTextMesh(text,
                this.position.x + xOffset,
                this.position.y + yOffset, CPU.TEXT_SIZE, CPU.ALU_COLOR)
            this.addTextMesh(meshName, mesh);
        };

        const opcodeSymbol = (opcode: string): string => {
            switch (opcode) {
                case "ADD":
                    return "+";
                case "SUB":
                    return "-";
                case "MUL":
                    return "x";
                case "AND":
                    return "&";
                case "OR":
                    return "v";
                default:
                    throw new Error("Invalid ALU opcode: " + opcode);
            }
        }
        const distanceToCenter = 0.09;

        const instruction = this.ALUs.get(i);
        if (!instruction)
            return;
        const aluProps = this.meshProperties.get(this.aluMeshName(i));
        drawALUTextComponent(`${this.aluMeshName(i)}_OPCODE`, opcodeSymbol(instruction.getOpcode()), aluProps.xOffset,
            aluProps.yOffset - 0.03);
        if (instruction.getOpcode() == "SUB")
            this.meshes.get(`${this.aluMeshName(i)}_OPCODE`).position.y -= 0.02;

        drawALUTextComponent(`${this.aluMeshName(i)}_OP1`, instruction.getOp1Reg(),
            aluProps.xOffset + distanceToCenter, aluProps.yOffset - 0.03);
        drawALUTextComponent(`${this.aluMeshName(i)}_OP2`, instruction.getOp2Reg(),
            aluProps.xOffset - distanceToCenter, aluProps.yOffset - 0.03);
        drawALUTextComponent(`${this.aluMeshName(i)}_RESULT`, instruction.getResultReg(), aluProps.xOffset,
            aluProps.yOffset + 0.04);
    }

    private computeCPUBodyMeshProperties(bodyWidth: number, bodyHeight: number): void {
        const cpuBody = {
            width: bodyWidth,
            height: bodyHeight,
            xOffset: 0,
            yOffset: 0,
            color: CPU.BODY_COLOR,
        };
        this.meshProperties.set(this.bodyMeshName, cpuBody);
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
        if (!this.isPipelined)
            this.scene.add(DrawUtils.buildTextMesh(this.fetchBufferMesh, fetchBuffer.xOffset, fetchBuffer.yOffset, CPU.TEXT_SIZE,
                CPU.COMPONENT_COLOR));

        const decodeBuffer = {
            width: bufferWidth,
            height: decoderHeight,
            xOffset: 2 * CPU.CONTENTS_MARGIN + memoryControllerWidth + (bufferWidth / 2) - (bodyWidth / 2) -
                CPU.INNER_SPACING,
            yOffset: fetchBuffer.yOffset + (fetchBuffer.height / 2) +
                (CPU.WORDS > 1 ? 1 : 3) * CPU.INNER_SPACING_L + (decoderHeight / 2),
            color: CPU.COMPONENT_COLOR,
        };
        this.drawBuffer(this.decodeBufferMesh, decodeBuffer, CPU.decoderCount, 0, CPU.INNER_SPACING_L / 2,
            CPU.COMPONENT_COLOR, true);
        if (!this.isPipelined)
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
                (innerHeight - fetchBuffer.height - decodeBuffer.height - (CPU.WORDS > 1 ? 2 : 4) * CPU.INNER_SPACING_L) / 2,
            color: CPU.BODY_COLOR,
        };
        this.meshProperties.set(this.registerFileParentMesh, registerFile);
        this.drawRegisterGridArray(registerFile, CPU.WORDS, CPU.WORD_SIZE, CPU.INNER_SPACING);
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
        const aluHeight = CPU.REGISTER_SIDE_LENGTH;
        for (let i = 0; i < CPU.aluCount; ++i) {
            const alu = {
                width: aluWidth,
                height: aluHeight,
                xOffset: bodyWidth / 2 - aluWidth / 2 - CPU.CONTENTS_MARGIN,
                yOffset: registerFile.yOffset + (i % 2 == 0 ? -1 : 1) * (registerFile.height / 2 - aluHeight / 2),
                color: CPU.COMPONENT_COLOR
            };
            this.meshProperties.set(this.aluMeshName(i), alu);
            this.scene.add(DrawUtils.buildTextMesh("ALU", alu.xOffset, alu.yOffset, CPU.TEXT_SIZE, CPU.COMPONENT_COLOR));
        }
    }

    private drawCPUPins(): void {
        this.drawPins(this.meshes.get(this.bodyMeshName), 'right', this.instructionMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
        this.drawPins(this.meshes.get(this.bodyMeshName), 'bottom', this.workingMemory.size).forEach((mesh, _name) => this.scene.add(mesh));
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

    private registerTextMeshName(name: string): string {
        return `${name}_CONTENT`;
    }

    private addRegisterValueMeshes(registerName: string): void {
        const mesh = DrawUtils.buildTextMesh(this.registerValues.get(registerName).toString(),
            this.position.x + this.meshProperties.get(registerName).xOffset,
            this.position.y + this.meshProperties.get(registerName).yOffset - DrawUtils.baseTextHeight / 4,
            CPU.TEXT_SIZE, CPU.TEXT_COLOR);
        this.addTextMesh(this.registerTextMeshName(registerName), mesh);
        if (!this.isPipelined)
            this.scene.add(this.meshes.get(this.registerTextMeshName(registerName)));
    }

    private addVerticalBufferTextMeshes(buffer: Queue<Instruction>, bufferMeshName: string): void {
        const bufferMesh = this.meshProperties.get(bufferMeshName);
        if (!buffer.get(0))
            return;
        const bufferTextMesh = DrawUtils.buildTextMesh(buffer.get(0).toString(), bufferMesh.xOffset, bufferMesh.yOffset, CPU.TEXT_SIZE,
            CPU.MEMORY_COLOR);
        bufferTextMesh.geometry.center().rotateZ(Math.PI / 2);
        bufferTextMesh.position.set(bufferMesh.xOffset, bufferMesh.yOffset, 0)
        this.addTextMesh(bufferMeshName, bufferTextMesh);
    }
}