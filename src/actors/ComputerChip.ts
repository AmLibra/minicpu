import {Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {Instruction} from "../components/Instruction";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";
import {CPU} from "./CPU";


/**
 * Abstract class for computer chips
 * @abstract
 * @class
 * @property {string} id The id of the chip
 * @property {{x: number, y: number}} position The position of the chip
 * @property {Scene} scene The scene to add the chip to
 * @property {Map<string, MeshProperties>} meshProperties The properties of the graphic
 *     components
 * @property {Map<string, Mesh>} meshes The graphic components of the chip
 * @property {Map<string, Mesh>} textMeshes The text components of the chip
 * @property {Map<string, string>} COLORS The colors of the chip
 */
export abstract class ComputerChip {
    public static readonly ONE_SECOND: number = 1000;

    public readonly id: string;
    protected readonly position: { x: number; y: number };
    protected readonly scene: Scene;

    protected static readonly COLORS: Map<string, MeshBasicMaterial> = new Map([
        ["BODY", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")})],
        ["COMPONENT", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")})],
        ["TEXT", new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")})]
    ]);

    protected static readonly TEXT_SIZE: number = 0.05;

    protected meshProperties: Map<string, MeshProperties>;
    protected readonly meshes: Map<string, Mesh>;
    protected readonly textMeshes: Map<string, Mesh>;

    protected constructor(id: string, position: [number, number], scene: Scene) {
        this.id = id;
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.meshes = new Map<string, Mesh>();
        this.meshProperties = new Map<string, MeshProperties>();
        this.textMeshes = new Map<string, Mesh>();
        this.computeMeshProperties();
        this.addMeshesToScene()
    }

    /**
     * Initializes the graphics of the chip
     * Is called in the constructor of all computer chips
     * NOTE: Does not need to worry about fonts being loaded
     * @protected
     */
    protected addMeshesToScene(): void {
        this.meshProperties.forEach((_dims, name) => this.scene.add(this.addSimpleMesh(name)));
    }

    /**
     * Computes the dimensions of the graphic components of the chip
     * Is called in the constructor of all computer chips
     * NOTE: Does not need to worry about fonts being loaded
     * @protected
     */
    abstract computeMeshProperties(): void;

    /**
     * Updates the chip
     * Is called in the update loop of all computer chips
     * @protected
     */
    abstract update(): void;

    /**
     * Renders the chip every frame
     * Is called in the update loop of all computer chips
     * @protected
     */
    abstract drawUpdate(): void;

    /**
     * Draws a simple graphic component, i.e. a quadrilateral with a solid color, used for the body of chips
     *
     * @param name The name of the component
     * @protected
     */
    protected addSimpleMesh(name: string): Mesh {
        if (!this.meshProperties.has(name))
            throw new Error(`Component ${name} not found`);

        const mesh = this.meshProperties.get(name);
        const quadrilateralMesh = DrawUtils.buildQuadrilateralMesh(
            mesh.width, mesh.height, mesh.color);
        quadrilateralMesh.position.set(this.position.x + mesh.xOffset, this.position.y + mesh.yOffset, 0);
        this.meshes.set(name, quadrilateralMesh);
        return quadrilateralMesh;
    }

    /**
     * Draws an array of vertical buffers
     *
     * @param parent the parent component of the buffers
     * @param memorySize the number of registers in the buffer
     * @param margin the margin between the buffer and the parent
     * @param spacing the spacing between each register
     * @param color the color of the registers
     * @param reverse whether to draw the buffers in reverse order
     * @protected
     */
    protected drawBuffer(parentName: string,
                         parent: MeshProperties, memorySize: number, margin: number, spacing: number, color: MeshBasicMaterial,
                         reverse: boolean = false
    ): Map<string, MeshProperties> {
        const bufferNames: Map<string, MeshProperties> = new Map<string, MeshProperties>();

        const innerHeight = parent.height - (2 * margin);
        const totalSpacing = spacing * (memorySize - 1);
        const rectangleHeight = (innerHeight - totalSpacing) / memorySize;
        const startYOffset = reverse ? parent.yOffset - margin - rectangleHeight / 2:
            parent.yOffset + margin + rectangleHeight / 2;
        for (let i = 0; i < memorySize; ++i) {
            const bufferName = `${parentName}_BUFFER_${i}`;
            const yOffset = reverse ? startYOffset - i * (rectangleHeight + spacing) + parent.height / 2 :
                startYOffset + i * (rectangleHeight + spacing) - parent.height / 2;

            const buffer = {
                width: parent.width - (2 * margin),
                height: rectangleHeight,
                xOffset: 0,
                yOffset: yOffset,
                color: color,
                immutable: true
            }
            this.meshProperties.set(bufferName, buffer);
            bufferNames.set(bufferName, buffer);
        }
        return bufferNames;
    }

    /**
     * Draws the contents of a buffer
     *
     * @param buffer the buffer to draw
     * @param bufferName the name of the buffer
     * @protected
     */
    protected drawBufferContents(buffer: Queue<Instruction>, bufferName: string) {
        for (let i = 0; i < buffer.size(); ++i) {
            const instruction = buffer.get(i);
            if (instruction) {
                const bufferReg = this.meshProperties.get(`${bufferName}_BUFFER_${i}`);
                this.textMeshes.set(`${bufferName}_BUFFER_${i}`,
                    DrawUtils.buildTextMesh(instruction.toString(),
                        this.position.x,
                        this.position.y + bufferReg.yOffset,
                        ComputerChip.TEXT_SIZE,
                        ComputerChip.COLORS.get("TEXT"))
                );
            }
        }
    }

    /**
     * Draws a grid of registers
     *
     * @param parent the parent component of the registers
     * @param rowCount the number of rows in the grid
     * @param columnCount the number of columns in the grid
     * @param padding the padding between each register
     * @param registerNames the names of the registers
     * @protected
     */
    protected drawGrid(parent: MeshProperties, rowCount: number, columnCount: number, padding: number, registerNames?: string[]
    ): Map<string, MeshProperties> {
        if (registerNames && registerNames.length != rowCount * columnCount) {
            throw new Error("Number of register names does not match the number of registers");
        }

        // Calculate dimensions for each individual register file, accounting for margins
        const registerWidth = (parent.width - padding * (columnCount - 1)) / columnCount;
        const registerHeight = (parent.height - padding * (rowCount - 1)) / rowCount;

        // Calculating the starting position
        const startX = parent.xOffset - parent.width / 2 + registerWidth / 2;
        const startY = parent.yOffset + parent.height / 2 - registerHeight / 2;

        const registers = new Map<string, MeshProperties>();

        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < columnCount; j++) {
                const xOffset = startX + j * (registerWidth + padding);
                const yOffset = startY - i * (registerHeight + padding);

                const registerName = registerNames ? registerNames[i * columnCount + j] : `R${i * columnCount + j}`;
                const register = {
                    width: registerWidth,
                    height: registerHeight,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    color: ComputerChip.COLORS.get("COMPONENT"),
                    immutable: false
                };

                this.meshProperties.set(registerName, register);
                registers.set(registerName, register);
            }
        }
        return registers;
    }

    protected drawPinsRight(parent: MeshProperties, pinCount: number, pinSpacing: number, pinNames?: string[]): Map<string, Mesh> {
        if (pinNames && pinNames.length != pinCount) {
            throw new Error("Number of pin names does not match the number of pins");
        }

        const pinRadius = 0.02;
        // Calculating the starting position
        const startX = parent.xOffset + parent.width / 2 + pinRadius;
        const startY = parent.yOffset + parent.height / 2 - 1.5 * pinRadius;

        const pins = new Map<string, Mesh>();

        for (let i = 0; i < pinCount; i++) {
            const xOffset = startX;
            const yOffset = startY - i * (pinRadius + pinSpacing);

            const pinName = pinNames ? pinNames[i] : `PIN${i}`;
            const pin = DrawUtils.buildCircleMesh(pinRadius, ComputerChip.COLORS.get("COMPONENT"));
            pin.position.set(xOffset, yOffset, 0);
            pins.set(pinName, pin);
        }
        return pins;
    }

    protected drawPinsLeft(parent: MeshProperties, pinCount: number, pinSpacing: number, pinNames?: string[]): Map<string, Mesh> {
        if (pinNames && pinNames.length != pinCount) {
            throw new Error("Number of pin names does not match the number of pins");
        }

        const pinRadius = 0.02;
        // Calculating the starting position
        const startX = parent.xOffset - parent.width / 2 - pinRadius;
        const startY = parent.yOffset + parent.height / 2 - 1.5 * pinRadius;

        const pins = new Map<string, Mesh>();

        for (let i = 0; i < pinCount; i++) {
            const xOffset = startX;
            const yOffset = startY - i * (pinRadius + pinSpacing);

            const pinName = pinNames ? pinNames[i] : `PIN${i}`;
            const pin = DrawUtils.buildCircleMesh(pinRadius, ComputerChip.COLORS.get("COMPONENT"));
            pin.position.set(xOffset, yOffset, 0);
            pins.set(pinName, pin);
        }
        return pins;
    }

    /**
     * Draws text for a simple buffer component
     *
     * @param componentName the name of the component
     * @param componentBuffer the buffer to draw text for
     * @param yOffsetIncrement the amount to increment the y offset by for each instruction
     * @protected
     */
    protected drawTextForComponent(componentName: string, componentBuffer: Queue<Instruction>): void {
        const componentProps = this.meshProperties.get(componentName);
        if (!componentProps) {
            console.warn(`Component properties for ${componentName} not found.`);
            return;
        }

        const baseYOffset = this.position.y +
            componentProps.yOffset + componentProps.height / 2 - DrawUtils.baseTextHeight / 2; // Calculate once
        const yOffsetIncrement = (componentProps.height - DrawUtils.baseTextHeight / 2) / componentBuffer.maxSize;
        for (let i = 0; i < componentBuffer.size(); ++i) {
            const instruction = componentBuffer.get(i);
            if (!instruction) continue; // Skip if no instruction

            const yOffset = baseYOffset - (i * yOffsetIncrement);
            const textMesh = DrawUtils.buildTextMesh(
                instruction.toString(),
                componentProps.xOffset,
                yOffset,
                ComputerChip.TEXT_SIZE,
                ComputerChip.COLORS.get("TEXT")
            );

            this.textMeshes.set(`${componentName}_TEXT_${i}`, textMesh);
        }
    }

    /**
     *  Changes the color of a component
     *
     * @param componentName the name of the component
     * @param newColor the new color of the component
     * @protected
     */
    protected changeComponentMesh(componentName: string, newMesh: MeshBasicMaterial): void {
        if (!this.meshProperties.has(componentName))
            throw new Error(`Component ${componentName} not found`);

        const mesh = this.meshes.get(componentName);
        if (!mesh)
            throw new Error(`Mesh ${componentName} not found`);

        mesh.material = newMesh;
    }


    /**
     * Changes the color of a graphic component for a short period of time
     *
     * @param componentName the name of the component
     * @param newMesh the new color of the component
     * @protected
     */
    protected blink(componentName: string, newMesh: MeshBasicMaterial): void {
        this.changeComponentMesh(componentName, newMesh);
        setTimeout(() =>
                this.changeComponentMesh(componentName, this.meshProperties.get(componentName).color),
            ComputerChip.ONE_SECOND / CPU.CLOCK_SPEED );
    }

    /**
     * Moves instructions from one buffer to another (for queues)
     *
     * @param from the buffer to move instructions from
     * @param to the buffer to move instructions to
     * @param count the number of instructions to move
     * @protected
     */
    protected moveInstructions(from: Queue<Instruction>, to: Queue<Instruction>, count: number): void {
        for (let i = 0; i < count; ++i) {
            if (from.isEmpty() || to.size() >= to.maxSize) break;
            to.enqueue(from.dequeue());
        }
    }

    /**
     * Converts a number to a hexadecimal string for display
     *
     * @param value the number to convert
     * @protected
     */
    public static toHex(value: number): string {
        return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    }
}
