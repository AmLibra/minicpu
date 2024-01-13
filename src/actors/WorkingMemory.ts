import {ComputerChip} from "./ComputerChip";
import {Material, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {CPU} from "./CPU";

export class WorkingMemory extends ComputerChip {
    public static readonly WORDS = 8;
    private size: number;
    private readonly memoryArray: number[];

    private memoryAddressToUpdate: number = -1;
    private ready: boolean = false;
    private memoryOperationTimeout: number = 0;

    // Mesh names
    private registerFileMesh: string;

    constructor(position: [number, number], scene: Scene, clockFrequency: number) {
        super(position, scene, clockFrequency);
        this.memoryArray = new Array(this.size);
        this.initialize();
        DrawUtils.updateText(this.clockMesh, DrawUtils.formatFrequency(this.clockFrequency));
    }

    public getSize(): number {
        return this.size;
    }

    public isReady(): boolean {
        return this.ready;
    }

    public askForMemoryOperation(cpu: CPU): void {
        if (this.memoryOperationTimeout > 0)
            return;
        this.ready = false;
        this.memoryOperationTimeout = cpu.getClockFrequency() / this.clockFrequency;
    }

    public read(address: number): number {
        if (!this.ready)
            throw new Error("MainMemory is not ready to be read");

        this.highlight(this.registerName(address), WorkingMemory.MEMORY_COLOR);
        this.ready = false;
        return this.memoryArray[address];
    }

    public write(address: number, value: number): void {
        if (!this.ready)
            throw new Error("MainMemory is not ready to be written to");

        this.highlight(this.registerName(address), WorkingMemory.MEMORY_COLOR);
        this.memoryArray[address] = value;
        this.memoryAddressToUpdate = address;
        this.ready = false;
    }

    computeMeshProperties(): void {
        // define mesh names
        this.bodyMesh = "BODY";
        this.registerFileMesh = "REGISTER_FILE";

        // compute variable mesh properties
        this.size = WorkingMemory.WORDS * WorkingMemory.WORD_SIZE;
        const bodyHeight = WorkingMemory.REGISTER_SIDE_LENGTH * WorkingMemory.WORDS + WorkingMemory.CONTENTS_MARGIN * 2
            + (WorkingMemory.WORDS - 1) * WorkingMemory.INNER_SPACING;
        const bodyWidth = WorkingMemory.REGISTER_SIDE_LENGTH * WorkingMemory.WORD_SIZE + WorkingMemory.CONTENTS_MARGIN * 2
            + (WorkingMemory.WORD_SIZE - 1) * WorkingMemory.INNER_SPACING;

        this.computeBodyMeshProperties(bodyWidth, bodyHeight);
        this.computeRegisterMeshProperties(bodyWidth, bodyHeight);

        this.drawPins(this.meshProperties.get(this.bodyMesh), 'right', WorkingMemory.WORDS).forEach((mesh, _name) => this.scene.add(mesh));
        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x,
            this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.HUD_TEXT_COLOR);
    }

    update(): void {
        if (this.memoryOperationTimeout > 0) {
            this.memoryOperationTimeout--;
            this.ready = this.memoryOperationTimeout <= 0;
        }
    }

    drawUpdate(): void {
        if (this.memoryAddressToUpdate < 0)
            return;
        DrawUtils.updateText(this.meshes.get(this.registerTextMeshName(this.registerName(this.memoryAddressToUpdate))),
            this.memoryArray[this.memoryAddressToUpdate].toString());
        this.memoryAddressToUpdate = -1;
    }

    private initialize(): void {
        for (let i = 0; i < this.size; i++) {
            this.memoryArray[i] = Math.floor(Math.random() * WorkingMemory.MAX_BYTE_VALUE);
            this.buildRegisterTextMesh(i);
        }
        // this.drawMemoryWordAddressTags();
        this.textMeshNames.forEach(mesh => this.scene.add(this.meshes.get(mesh)));
    }

    private buildRegisterTextMesh(address: number): void {
        const memoryAddressRegister = this.meshProperties.get(this.registerName(address));
        const mesh = DrawUtils.buildTextMesh(this.memoryArray[address].toString(),
                this.position.x + memoryAddressRegister.xOffset,
                this.position.y + memoryAddressRegister.yOffset - DrawUtils.baseTextHeight / 4,
                WorkingMemory.TEXT_SIZE, WorkingMemory.TEXT_COLOR
            );
        this.addTextMesh(this.registerTextMeshName(this.registerName(address)), mesh);
    }

    private computeBodyMeshProperties(bodyWidth: number, bodyHeight: number): void {
        const body = {
            width: bodyWidth,
            height: bodyHeight,
            xOffset: 0,
            yOffset: 0,
            color: WorkingMemory.BODY_COLOR,
        };
        this.meshProperties.set(this.bodyMesh, body);
    }

    private computeRegisterMeshProperties(bodyWidth: number, bodyHeight: number): void {
        const registerFile = {
            width: bodyWidth - (2 * WorkingMemory.CONTENTS_MARGIN),
            height: bodyHeight - (2 * WorkingMemory.CONTENTS_MARGIN),
            xOffset: 0,
            yOffset: 0,
            color: WorkingMemory.BODY_COLOR,
        };
        this.meshProperties.set(this.registerFileMesh, registerFile);

        const registerNames = [];
        for (let i = 0; i < this.size; i++)
            registerNames.push(this.registerName(i));

        this.drawRegisterGridArray(registerFile, WorkingMemory.WORDS, WorkingMemory.WORD_SIZE, WorkingMemory.INNER_SPACING, registerNames);
    }

    registerName(address: number): string {
        return DrawUtils.toHex(address);
    }

    private registerTextMeshName(name: string): string {
        return `${name}_CONTENT`;
    }
}