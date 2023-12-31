import {Material, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {Instruction} from "../components/Instruction";
import {MeshProperties} from "../components/MeshProperties";
import {Queue} from "../components/Queue";

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
    public static readonly ONE_SECOND: number = 1000; // ms
    protected static readonly TEXT_SIZE: number = 0.05;
    protected static readonly PIN_MARGIN = 0.1
    protected static readonly PIN_RADIUS = 0.02;

    protected static readonly BUFFER_HEIGHT: number = 0.12;
    protected static readonly REGISTER_SIDE_LENGTH: number = 0.15;
    protected static readonly CONTENTS_MARGIN = 0.03;
    protected static readonly INNER_SPACING = 0.01;
    protected static readonly WORD_SIZE = 4; // bytes
    protected static readonly MAX_BYTE_VALUE = 16;

    protected static readonly BODY_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly COMPONENT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARKER")});
    protected static readonly TEXT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    protected static readonly HUD_TEXT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    protected static readonly MEMORY_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_GREEN")});
    protected static readonly ALU_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT_RED")});
    protected static readonly PIN_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("GOLDEN_YELLOW")});

    protected readonly meshProperties: Map<string, MeshProperties>;
    protected readonly meshes: Map<string, Mesh>;
    protected readonly textMeshes: Map<string, Mesh>;
    protected readonly blinkStates = new Map<string, NodeJS.Timeout>();
    protected clockMesh: Mesh;

    protected readonly scene: Scene;
    protected readonly position: { x: number; y: number };
    protected clockFrequency: number = 1;
    private paused: boolean = false;
    private queuedBlinks: Array<() => void> = [];

    protected constructor(position: [number, number], scene: Scene) {
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.meshes = new Map<string, Mesh>();
        this.meshProperties = new Map<string, MeshProperties>();
        this.textMeshes = new Map<string, Mesh>();
        this.computeMeshProperties();
        this.addMeshesToScene()
    }

    /**
     * Computes the dimensions of the graphic components of the chip
     * Is called in the constructor of all computer chips
     *
     * @protected
     */
    abstract computeMeshProperties(): void;

    /**
     * Updates the chip
     * Is called in the update loop of all computer chips
     *
     * @protected
     */
    abstract update(): void;

    /**
     * Renders the chip every frame
     * Is called in the update loop of all computer chips
     *
     * @protected
     */
    abstract drawUpdate(): void;

    public togglePauseState() {
        this.paused = !this.paused;
        if (!this.paused) {
            this.queuedBlinks.forEach(blinkAction => blinkAction());
            this.queuedBlinks = []; // Clear the queue
        }
    }

    /**
     * Returns the clock frequency of the chip
     *
     * @returns {number} The clock frequency
     */
    public getClockFrequency(): number {
        return this.clockFrequency;
    }

    /**
     * Draws a simple graphic component, i.e. a quadrilateral with a solid color, used for the body of chips
     *
     * @param name The name of the component
     * @returns {Mesh} The graphic component
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
     * @param parentName the name of the parent component of the buffers
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
        const startYOffset = reverse ? parent.yOffset - margin - rectangleHeight / 2 :
            parent.yOffset + margin + rectangleHeight / 2;
        for (let i = 0; i < memorySize; ++i) {
            const bufferName = this.bufferMeshName(parentName, i);
            const yOffset = reverse ? startYOffset - i * (rectangleHeight + spacing) + parent.height / 2 :
                startYOffset + i * (rectangleHeight + spacing) - parent.height / 2;

            const buffer = {
                width: parent.width - (2 * margin),
                height: rectangleHeight,
                xOffset: parent.xOffset,
                yOffset: yOffset,
                color: color,
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
    protected addBufferTextMeshes(buffer: Queue<Instruction>, bufferName: string) {
        for (let i = 0; i < buffer.size(); ++i) {
            const instruction = buffer.get(i);
            if (instruction) {
                const bufferReg = this.meshProperties.get(this.bufferMeshName(bufferName, i));
                this.textMeshes.set(this.bufferTextMeshName(bufferName, i),
                    DrawUtils.buildTextMesh(instruction.toString(),
                        this.position.x,
                        this.position.y + bufferReg.yOffset + DrawUtils.baseTextHeight / 8,
                        ComputerChip.TEXT_SIZE,
                        instruction.isMemoryOperation() ? ComputerChip.MEMORY_COLOR : ComputerChip.ALU_COLOR)
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
    protected drawRegisterGridArray(parent: MeshProperties, rowCount: number, columnCount: number, padding: number, registerNames?: string[]
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

                const registerName = registerNames ? registerNames[i * columnCount + j] : this.registerName(i * columnCount + j);
                const register = {
                    width: registerWidth,
                    height: registerHeight,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    color: ComputerChip.COMPONENT_COLOR,
                };

                this.meshProperties.set(registerName, register);
                registers.set(registerName, register);
            }
        }
        return registers;
    }

    protected drawPins(parent: MeshProperties, side: 'left' | 'right' | 'top' | 'bottom', pinCount: number): Map<string, Mesh> {
        const pins = new Map<string, Mesh>();
        let startX: number;
        let startY: number;
        let pinSpacing: number;
        const spaceToFillHorizontal = parent.width - 2 * ComputerChip.PIN_MARGIN;
        const spaceToFillVertical = parent.height - 2 * ComputerChip.PIN_MARGIN;

        switch (side) {
            case 'left':
            case 'right':
                startX = side === 'left' ? this.position.x + parent.xOffset - parent.width / 2 - ComputerChip.PIN_RADIUS - 0.01 :
                    this.position.x + parent.xOffset + parent.width / 2 + ComputerChip.PIN_RADIUS + 0.01;
                startY = this.position.y + parent.yOffset + parent.height / 2 - ComputerChip.PIN_MARGIN - ComputerChip.PIN_RADIUS;
                pinSpacing = (spaceToFillVertical - pinCount * (2 * ComputerChip.PIN_RADIUS)) / (pinCount - 1);
                break;
            case 'top':
            case 'bottom':
                startY = side === 'top' ? this.position.y + parent.yOffset + parent.height / 2 + ComputerChip.PIN_RADIUS + 0.01 :
                    this.position.y + parent.yOffset - parent.height / 2 - ComputerChip.PIN_RADIUS - 0.01;
                startX = this.position.x + parent.xOffset - parent.width / 2 + ComputerChip.PIN_MARGIN + ComputerChip.PIN_RADIUS;
                pinSpacing = (spaceToFillHorizontal - pinCount * (2 * ComputerChip.PIN_RADIUS)) / (pinCount - 1);
                break;
        }

        // Create and place pins
        for (let i = 0; i < pinCount; i++) {
            const xOffset = side === 'left' || side === 'right' ? startX : startX + i * (2 * ComputerChip.PIN_RADIUS + pinSpacing);
            const yOffset = side === 'left' || side === 'right' ? startY - i * (2 * ComputerChip.PIN_RADIUS + pinSpacing) : startY;

            const pinName = this.pinName(i);
            const pin = (side === 'left' || side === 'right') ?
                DrawUtils.buildQuadrilateralMesh(ComputerChip.PIN_RADIUS * 2, ComputerChip.PIN_RADIUS,
                    ComputerChip.PIN_COLOR) :
                DrawUtils.buildQuadrilateralMesh(ComputerChip.PIN_RADIUS, ComputerChip.PIN_RADIUS * 2,
                    ComputerChip.PIN_COLOR);

            pin.position.set(xOffset, yOffset, 0);
            pins.set(pinName, pin);
        }
        return pins;
    }

    protected clearMutableTextMeshes(...exceptions: string[]): void {
        const toDispose = [];
        this.textMeshes.forEach((mesh, componentName) => {
                if (exceptions.includes(componentName))
                    return;
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (mesh.material instanceof Material)
                    mesh.material.dispose();
                toDispose.push(componentName);
            }
        );
        toDispose.forEach(comp => this.textMeshes.delete(comp));
    }

    /**
     *  Changes the color of a component
     *
     * @param componentName the name of the component
     * @param newMesh the new color of the component
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
     * @param blinkDuration the duration of the blink in ms
     * @protected
     */
    protected blink(componentName: string, newMesh: MeshBasicMaterial, blinkDuration?: number): void {
        const blinkAction = () => {
            if (this.blinkStates.has(componentName)) {
                clearTimeout(this.blinkStates.get(componentName));
                this.blinkStates.delete(componentName);
            }

            this.changeComponentMesh(componentName, newMesh);
            const timeout = setTimeout(() => {
                if (this.meshProperties.has(componentName)) {
                    this.changeComponentMesh(componentName, this.meshProperties.get(componentName).color);
                }
                this.blinkStates.delete(componentName);
            }, blinkDuration ? blinkDuration : ComputerChip.ONE_SECOND / this.clockFrequency);

            this.blinkStates.set(componentName, timeout);
        };
        if (this.paused)
            this.queuedBlinks.push(blinkAction);
        else
            blinkAction();
    }

    protected delay(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
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

    protected pinName(pinNumber: number): string {
        return `PIN${pinNumber}`;
    }

    protected registerName(registerNumber: number): string {
        return `R${registerNumber}`;
    }

    protected bufferMeshName(bufferName: string, index: number = 0): string {
        return `${bufferName}_BUFFER_${index}`;
    }

    protected bufferTextMeshName(bufferName: string, index: number): string {
        return `${bufferName}_BUFFER_${index}`;
    }

    /**
     * Initializes the graphics of the chip
     * Is called in the constructor of all computer chips
     *
     * @protected
     */
    private addMeshesToScene(): void {
        this.meshProperties.forEach((_dims, name) => this.scene.add(this.addSimpleMesh(name)));
        this.scene.add(this.clockMesh);
    }
}
