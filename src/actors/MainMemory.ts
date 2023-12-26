import {ComputerChip} from "./ComputerChip";
import {Scene} from "three";
import {DrawUtils} from "../DrawUtils";

export class MainMemory extends ComputerChip {
    public static readonly WIDTH: number = 0.75;
    public static readonly HEIGHT: number = 2.4;
    public static readonly COMPONENTS_INNER_MARGIN = 0.03;
    public static readonly COMPONENTS_SPACING = 0.01;
    public static readonly ROW_COUNT = 16; // 16 words
    public static readonly COL_COUNT = 4; // 4 bytes per word
    public static readonly SIZE: number = MainMemory.ROW_COUNT * MainMemory.COL_COUNT;

    public static readonly MAX_VALUE = 256

    private readonly memory: number[];
    private static readonly MEMORY_ADDRESS_NAMES: string[] = [];
    static {
        for (let i = 0; i < MainMemory.SIZE; i++)
            MainMemory.MEMORY_ADDRESS_NAMES.push(ComputerChip.toHex(i));
    }

    private memoryAddressToUpdate: number = -1;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
        this.memory = new Array(MainMemory.SIZE);
        this.initialize();
    }

    public read(address: number): number {
        this.blink(MainMemory.MEMORY_ADDRESS_NAMES[address], MainMemory.COLORS.get("TEXT"));
        return this.memory[address];
    }

    public write(address: number, value: number): void {
        this.blink(MainMemory.MEMORY_ADDRESS_NAMES[address], MainMemory.COLORS.get("TEXT"));
        this.memory[address] = value;
        this.memoryAddressToUpdate = address;
    }

    computeMeshProperties(): void {
        const body = {
            width: MainMemory.WIDTH,
            height: MainMemory.HEIGHT,
            xOffset: 0,
            yOffset: 0,
            color: MainMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("BODY", body);

        const memoryAddressMargin = {
            width: 6 * MainMemory.COMPONENTS_INNER_MARGIN,
            height: MainMemory.HEIGHT,
            xOffset: MainMemory.WIDTH / 2 + MainMemory.COMPONENTS_INNER_MARGIN + MainMemory.COMPONENTS_INNER_MARGIN,
            yOffset: 0,
            color: MainMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("MEMORY_ADDRESS_MARGIN", memoryAddressMargin);

        const registerFile = {
            width: MainMemory.WIDTH - (2 * MainMemory.COMPONENTS_INNER_MARGIN),
            height: MainMemory.HEIGHT - (2 * MainMemory.COMPONENTS_INNER_MARGIN),
            xOffset: 0,
            yOffset: 0,
            color: MainMemory.COLORS.get("BODY"),
            immutable: true
        };
        this.meshProperties.set("REGISTER_FILE", registerFile);

        this.drawGrid(registerFile, MainMemory.ROW_COUNT, MainMemory.COL_COUNT, MainMemory.COMPONENTS_SPACING,
            MainMemory.MEMORY_ADDRESS_NAMES)
            .forEach((dimensions, name) => {
                this.textMeshes.set(name,
                    DrawUtils.buildTextMesh(name,
                        this.position.x + dimensions.xOffset,
                        this.position.y + dimensions.yOffset + dimensions.height / 2,
                        MainMemory.TEXT_SIZE / 2, MainMemory.COLORS.get("BODY")));
            });
    }

    update(): void {
        // nothing to do
    }

    drawUpdate(): void {
        if (this.memoryAddressToUpdate < 0)
            return;
        const modifiedTextMeshName = `${MainMemory.MEMORY_ADDRESS_NAMES[this.memoryAddressToUpdate]}_CONTENT`;
        this.scene.remove(this.textMeshes.get(modifiedTextMeshName));
        this.textMeshes.delete(modifiedTextMeshName);
        this.drawMemoryContent(this.memoryAddressToUpdate);
        this.scene.add(this.textMeshes.get(modifiedTextMeshName));
        this.memoryAddressToUpdate = -1;

    }

    private initialize(): void {
        for (let i = 0; i < MainMemory.SIZE; i++)
            this.memory[i] = Math.floor(Math.random() * MainMemory.MAX_VALUE);
        this.drawAllMemoryContent()
        this.drawMemoryWordAddressTags();
        this.textMeshes.forEach(mesh => this.scene.add(mesh));
    }

    private drawAllMemoryContent(): void {
        for (let i = 0; i < MainMemory.SIZE; i++)
            this.drawMemoryContent(i);
    }

    private drawMemoryContent(address: number): void {
        const memoryAddressRegister = this.meshProperties.get(
            MainMemory.MEMORY_ADDRESS_NAMES[address]);
        this.textMeshes.set(
            `${MainMemory.MEMORY_ADDRESS_NAMES[address]}_CONTENT`,
            DrawUtils.buildTextMesh(this.memory[address].toString(),
                this.position.x + memoryAddressRegister.xOffset,
                this.position.y + memoryAddressRegister.yOffset,
                MainMemory.TEXT_SIZE, MainMemory.COLORS.get("TEXT")
            ));
    }

    private drawMemoryWordAddressTags(): void {
        for (let i = 0; i < MainMemory.ROW_COUNT; i++) {
            const memoryAddressRegister = this.meshProperties.get(
                MainMemory.MEMORY_ADDRESS_NAMES[i * MainMemory.COL_COUNT]);
            this.textMeshes.set(
                `${MainMemory.MEMORY_ADDRESS_NAMES[i * MainMemory.COL_COUNT]}_OFFSET`,
                DrawUtils.buildTextMesh(
                    MainMemory.toHex(i * MainMemory.COL_COUNT),
                    this.position.x + this.meshProperties.get("MEMORY_ADDRESS_MARGIN").xOffset
                    - MainMemory.COMPONENTS_INNER_MARGIN,
                    this.position.y + memoryAddressRegister.yOffset + memoryAddressRegister.height / 2,
                    MainMemory.TEXT_SIZE/2, MainMemory.COLORS.get("TEXT")
                ));
        }
    }
}