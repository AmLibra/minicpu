import {ComputerChip} from "./ComputerChip";
import {Material, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {CPU} from "./CPU";

export class WorkingMemory extends ComputerChip {
    public static readonly WORDS = 4;
    private size: number;
    private readonly memoryArray: number[];

    private memoryAddressToUpdate: number = -1;
    private ready: boolean = false;
    private memoryOperationTimeout: number = 0;

    // Mesh names
    private bodyMesh: string;
    private memoryAddressMarginMesh: string;
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

        this.blink(this.registerName(address), WorkingMemory.MEMORY_COLOR);
        this.ready = false;
        return this.memoryArray[address];
    }

    public write(address: number, value: number): void {
        if (!this.ready)
            throw new Error("MainMemory is not ready to be written to");

        this.blink(this.registerName(address), WorkingMemory.MEMORY_COLOR);
        this.memoryArray[address] = value;
        this.memoryAddressToUpdate = address;
        this.ready = false;
    }

    computeMeshProperties(): void {
        // define mesh names
        this.bodyMesh = "BODY";
        this.memoryAddressMarginMesh = "MEMORY_ADDRESS_MARGIN";
        this.registerFileMesh = "REGISTER_FILE";

        // compute variable mesh properties
        this.size = WorkingMemory.WORDS * WorkingMemory.WORD_SIZE;
        const bodyHeight = WorkingMemory.REGISTER_SIDE_LENGTH * WorkingMemory.WORDS;
        const bodyWidth = WorkingMemory.REGISTER_SIDE_LENGTH * WorkingMemory.WORDS + WorkingMemory.CONTENTS_MARGIN * 2;

        this.computeBodyMeshProperties(bodyWidth, bodyHeight);
        this.computeAddressMarginMeshProperties(bodyWidth, bodyHeight)
        this.computeRegisterMeshProperties(bodyWidth, bodyHeight);

        this.drawPins(this.meshProperties.get(this.memoryAddressMarginMesh), 'right', WorkingMemory.WORDS).forEach((mesh, _name) => this.scene.add(mesh));
        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x + this.meshProperties.get(this.memoryAddressMarginMesh).width / 2,
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
        this.updateRegisterTextMesh(this.registerTextMeshName(this.registerName(this.memoryAddressToUpdate)));
        this.memoryAddressToUpdate = -1;
    }

    private initialize(): void {
        for (let i = 0; i < this.size; i++) {
            this.memoryArray[i] = Math.floor(Math.random() * WorkingMemory.MAX_BYTE_VALUE);
            this.buildRegisterTextMesh(i);
        }
        this.drawMemoryWordAddressTags();
        this.textMeshes.forEach(mesh => this.scene.add(mesh));
    }

    private buildRegisterTextMesh(address: number): void {
        const memoryAddressRegister = this.meshProperties.get(this.registerName(address));
        this.textMeshes.set(
            this.registerTextMeshName(this.registerName(address)),
            DrawUtils.buildTextMesh(this.memoryArray[address].toString(),
                this.position.x + memoryAddressRegister.xOffset,
                this.position.y + memoryAddressRegister.yOffset - DrawUtils.baseTextHeight / 4,
                WorkingMemory.TEXT_SIZE, WorkingMemory.TEXT_COLOR
            ));
    }

    private drawMemoryWordAddressTags(): void {
        for (let i = 0; i < WorkingMemory.WORDS; i++) {
            const memoryAddressRegister =
                this.meshProperties.get(this.registerName(i * WorkingMemory.WORD_SIZE));
            this.scene.add(
                DrawUtils.buildTextMesh(
                    DrawUtils.toHex(i * WorkingMemory.WORD_SIZE),
                    this.position.x + this.meshProperties.get(this.memoryAddressMarginMesh).xOffset
                    - WorkingMemory.CONTENTS_MARGIN,
                    this.position.y + memoryAddressRegister.yOffset + memoryAddressRegister.height / 2,
                    WorkingMemory.TEXT_SIZE / 2, WorkingMemory.TEXT_COLOR
                )
            );
        }
    }

    private updateRegisterTextMesh(meshName: string): void {
        this.scene.remove(this.textMeshes.get(meshName));
        this.textMeshes.get(meshName).geometry.dispose();
        if (this.textMeshes.get(meshName).material instanceof Material)
            (this.textMeshes.get(meshName).material as Material).dispose();
        this.textMeshes.delete(meshName);
        this.buildRegisterTextMesh(this.memoryAddressToUpdate);
        this.scene.add(this.textMeshes.get(meshName));
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

    private computeAddressMarginMeshProperties(bodyWidth: number, bodyHeight: number): void {
        const memoryAddressMargin = {
            width: 6 * WorkingMemory.CONTENTS_MARGIN,
            height: bodyHeight,
            xOffset: bodyWidth / 2 + WorkingMemory.CONTENTS_MARGIN + WorkingMemory.CONTENTS_MARGIN,
            yOffset: 0,
            color: WorkingMemory.BODY_COLOR,
        };
        this.meshProperties.set(this.memoryAddressMarginMesh, memoryAddressMargin);
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

        this.drawRegisterGridArray(registerFile, WorkingMemory.WORDS, WorkingMemory.WORD_SIZE, WorkingMemory.INNER_SPACING, registerNames)
            .forEach((dimensions, name) => {
                this.scene.add( // draw the memory address on each register
                    DrawUtils.buildTextMesh(name,
                        this.position.x + dimensions.xOffset,
                        this.position.y + dimensions.yOffset + dimensions.height / 2 - DrawUtils.baseTextHeight / 4,
                        WorkingMemory.TEXT_SIZE / 2, WorkingMemory.BODY_COLOR)
                );
            });
    }

    registerName(address: number): string {
        return DrawUtils.toHex(address);
    }

    private registerTextMeshName(name: string): string {
        return `${name}_CONTENT`;
    }
}