import {ComputerChip} from "./ComputerChip";
import {Material, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {CPU} from "./CPU";

export class WorkingMemory extends ComputerChip {

    public static readonly COMPONENTS_INNER_MARGIN = 0.03;
    public static readonly COMPONENTS_SPACING = 0.01;
    public static readonly ROW_COUNT = 4; // words
    public static readonly COL_COUNT = 4; // bytes per word
    public static readonly SIZE: number = WorkingMemory.ROW_COUNT * WorkingMemory.COL_COUNT;
    public static readonly REGISTER_SIZE: number = 0.15;

    public static readonly WIDTH: number = (WorkingMemory.REGISTER_SIZE) * WorkingMemory.COL_COUNT
        + WorkingMemory.COMPONENTS_INNER_MARGIN * 2;
    public static readonly HEIGHT: number = WorkingMemory.REGISTER_SIZE * WorkingMemory.ROW_COUNT

    public static readonly MAX_VALUE = 16

    private readonly memory: number[];
    private static readonly MEMORY_ADDRESS_NAMES: string[] = [];
    static {
        for (let i = 0; i < WorkingMemory.SIZE; i++)
            WorkingMemory.MEMORY_ADDRESS_NAMES.push(ComputerChip.toHex(i));
    }

    private memoryAddressToUpdate: number = -1;
    public readyToExecuteMemoryOperation: boolean = false;
    private memoryOperationTimeout: number = 0;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.memory = new Array(WorkingMemory.SIZE);
        this.initialize();
        this.clockFrequency = 1; // frequencies higher than cpu clock frequency will cause problems
    }

    public askForMemoryOperation(cpu: CPU, address: number): void {
        if (this.memoryOperationTimeout > 0)
            return;
        this.readyToExecuteMemoryOperation = false;
        this.memoryOperationTimeout = cpu.getClockFrequency() / this.clockFrequency;
    }

    public read(address: number): number {
        if (!this.readyToExecuteMemoryOperation)
            throw new Error("MainMemory is not ready to be read");
        this.blink(WorkingMemory.MEMORY_ADDRESS_NAMES[address], WorkingMemory.COLORS.get("MEMORY"));
        this.readyToExecuteMemoryOperation = false;
        return this.memory[address];
    }

    public write(address: number, value: number): void {
        if (!this.readyToExecuteMemoryOperation)
            throw new Error("MainMemory is not ready to be written to");
        this.blink(WorkingMemory.MEMORY_ADDRESS_NAMES[address], WorkingMemory.COLORS.get("MEMORY"));
        this.memory[address] = value;
        this.memoryAddressToUpdate = address;
        this.readyToExecuteMemoryOperation = false;
    }

    computeMeshProperties(): void {
        const body = {
            width: WorkingMemory.WIDTH,
            height: WorkingMemory.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: WorkingMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("BODY", body);

        const memoryAddressMargin = {
            width: 6 * WorkingMemory.COMPONENTS_INNER_MARGIN,
            height: WorkingMemory.HEIGHT,
            xOffset: WorkingMemory.WIDTH / 2 + WorkingMemory.COMPONENTS_INNER_MARGIN + WorkingMemory.COMPONENTS_INNER_MARGIN,
            yOffset: 0,
            color: WorkingMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("MEMORY_ADDRESS_MARGIN", memoryAddressMargin);

        const registerFile = {
            width: WorkingMemory.WIDTH - (2 * WorkingMemory.COMPONENTS_INNER_MARGIN),
            height: WorkingMemory.HEIGHT - (2 * WorkingMemory.COMPONENTS_INNER_MARGIN),
            xOffset: 0,
            yOffset: 0,
            color: WorkingMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("REGISTER_FILE", registerFile);

        this.drawGrid(registerFile, WorkingMemory.ROW_COUNT, WorkingMemory.COL_COUNT, WorkingMemory.COMPONENTS_SPACING,
            WorkingMemory.MEMORY_ADDRESS_NAMES)
            .forEach((dimensions, name) => {
                this.scene.add(
                    DrawUtils.buildTextMesh(name,
                        this.position.x + dimensions.xOffset,
                        this.position.y + dimensions.yOffset + dimensions.height / 2 - DrawUtils.baseTextHeight / 4,
                        WorkingMemory.TEXT_SIZE / 2, WorkingMemory.COLORS.get("BODY"))
                );
            });

        this.drawPins(this.meshProperties.get("MEMORY_ADDRESS_MARGIN"), 'right', WorkingMemory.ROW_COUNT).forEach((mesh, _name) => this.scene.add(mesh));

        this.clockMesh = DrawUtils.buildTextMesh("clock: " + this.clockFrequency + " Hz",
            this.position.x + memoryAddressMargin.width / 2
            , this.position.y + WorkingMemory.HEIGHT / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.COLORS.get("HUD_TEXT"));
    }

    update(): void {
        if (this.memoryOperationTimeout > 0) {
            this.memoryOperationTimeout--;
            if (this.memoryOperationTimeout <= 0
                && this.blinkStates.size === 0
            )
            {
                this.readyToExecuteMemoryOperation = true;
            }
        }
    }

    drawUpdate(): void {
        DrawUtils.updateMeshText(this.clockMesh, "clock: " + this.clockFrequency + " Hz");
        if (this.memoryAddressToUpdate < 0)
            return;
        const modifiedTextMeshName = `${WorkingMemory.MEMORY_ADDRESS_NAMES[this.memoryAddressToUpdate]}_CONTENT`;
        this.scene.remove(this.textMeshes.get(modifiedTextMeshName));
        this.textMeshes.get(modifiedTextMeshName).geometry.dispose();
        if (this.textMeshes.get(modifiedTextMeshName).material instanceof Material)
            (this.textMeshes.get(modifiedTextMeshName).material as Material).dispose();
        this.textMeshes.delete(modifiedTextMeshName);
        this.drawMemoryContent(this.memoryAddressToUpdate);
        this.scene.add(this.textMeshes.get(modifiedTextMeshName));
        this.memoryAddressToUpdate = -1;

    }

    private initialize(): void {
        for (let i = 0; i < WorkingMemory.SIZE; i++)
            this.memory[i] = Math.floor(Math.random() * WorkingMemory.MAX_VALUE);
        this.drawAllMemoryContent()
        this.drawMemoryWordAddressTags();
        this.textMeshes.forEach(mesh => this.scene.add(mesh));
    }

    private drawAllMemoryContent(): void {
        for (let i = 0; i < WorkingMemory.SIZE; i++)
            this.drawMemoryContent(i);
    }

    private drawMemoryContent(address: number): void {
        const memoryAddressRegister = this.meshProperties.get(
            WorkingMemory.MEMORY_ADDRESS_NAMES[address]);
        this.textMeshes.set(
            `${WorkingMemory.MEMORY_ADDRESS_NAMES[address]}_CONTENT`,
            DrawUtils.buildTextMesh(this.memory[address].toString(),
                this.position.x + memoryAddressRegister.xOffset,
                this.position.y + memoryAddressRegister.yOffset
                - DrawUtils.baseTextHeight / 4,
                WorkingMemory.TEXT_SIZE, WorkingMemory.COLORS.get("TEXT")
            ));
    }

    private drawMemoryWordAddressTags(): void {
        for (let i = 0; i < WorkingMemory.ROW_COUNT; i++) {
            const memoryAddressRegister = this.meshProperties.get(WorkingMemory.MEMORY_ADDRESS_NAMES[i * WorkingMemory.COL_COUNT]);
            this.scene.add(
                DrawUtils.buildTextMesh(
                    WorkingMemory.toHex(i * WorkingMemory.COL_COUNT),
                    this.position.x + this.meshProperties.get("MEMORY_ADDRESS_MARGIN").xOffset
                    - WorkingMemory.COMPONENTS_INNER_MARGIN,
                    this.position.y + memoryAddressRegister.yOffset + memoryAddressRegister.height / 2,
                    WorkingMemory.TEXT_SIZE / 2, WorkingMemory.COLORS.get("TEXT")
                )
            );
        }
    }
}