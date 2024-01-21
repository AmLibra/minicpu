import {Group, Material, Mesh, MeshBasicMaterial, Scene, Vector2} from "three";
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
 * @property {Map<string, Mesh>} textMeshNames The text components of the chip
 */
export abstract class ComputerChip {
    public static readonly ONE_SECOND: number = 1000; // ms
    protected static readonly TEXT_SIZE: number = 0.05;
    protected static readonly PIN_MARGIN = 0.05;
    protected static readonly PIN_RADIUS = 0.02;

    protected static readonly BUFFER_HEIGHT: number = 0.15;
    protected static readonly REGISTER_SIDE_LENGTH: number = 0.15;
    protected static readonly CONTENTS_MARGIN = 0.03;
    protected static readonly INNER_SPACING = 0.01;
    protected static readonly WORD_SIZE = 4; // bytes
    protected static readonly MAX_BYTE_VALUE = 8;

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
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});

    protected readonly meshProperties: Map<string, MeshProperties>;
    protected readonly meshes: Map<string, Mesh>;
    protected readonly textMeshNames: Array<string>;
    protected readonly blinkStates = new Map<string, {
        timeout: NodeJS.Timeout,
        startTime: number,
        duration: number
    }>();
    private readonly pausedBlinks: Map<string, MeshBasicMaterial>;
    private queuedBlinks: Array<() => void> = [];
    protected bodyMesh: string;
    protected pinPositions: Map<string, Vector2>;
    protected selectedMesh: Mesh;
    protected clockMesh: Mesh;

    public readonly scene: Scene;
    readonly position: { x: number; y: number };
    protected clockFrequency: number = 1;
    protected paused: boolean = false;

    protected constructor(position: [number, number], scene: Scene, clockFrequency: number) {
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.clockFrequency = clockFrequency;
        this.meshes = new Map<string, Mesh>();
        this.meshProperties = new Map<string, MeshProperties>();
        this.textMeshNames = new Array<string>();
        this.pinPositions = new Map<string, Vector2>();
        this.pausedBlinks = new Map<string, MeshBasicMaterial>();
    }

    abstract displayName(): string;

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
            this.resumeBlinks();
        } else {
            this.pauseBlinks();
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

    public getHitboxMesh(): Mesh {
        return this.meshes.get(this.bodyMesh);
    }

    public select(): ComputerChip {
        this.scene.add(this.selectedMesh);
        this.clockMesh.visible = true;
        return this;
    }

    public deselect(): undefined {
        this.scene.remove(this.selectedMesh);
        this.clockMesh.visible = false;
        return undefined;
    }

    public getPinPosition(n: number, side: 'left' | 'right' | 'top' | 'bottom'): Vector2 {
        return this.pinPositions.get(this.pinName(n, side));
    }

    protected getClockCycleDuration(): number {
        return ComputerChip.ONE_SECOND / this.clockFrequency;
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
            mesh.width, mesh.height, mesh.color, {x: this.position.x + mesh.xOffset, y: this.position.y + mesh.yOffset});
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
                this.textMeshNames.push(this.bufferTextMeshName(bufferName, i));
                this.meshes.set(this.bufferTextMeshName(bufferName, i),
                    DrawUtils.buildTextMesh(instruction.toString(),
                        this.position.x + bufferReg.xOffset,
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
     * @param transposed whether to draw the grid transposed (for naming)
     * @protected
     */
    protected drawRegisterGridArray(parent: MeshProperties, rowCount: number, columnCount: number, padding: number,
                                    registerNames?: string[], transposed: boolean = false): Map<string, MeshProperties> {
        if (registerNames && registerNames.length != rowCount * columnCount) {
            throw new Error("Number of register names does not match the number of registers");
        }

        const registerWidth = (parent.width - padding * (columnCount - 1)) / columnCount;
        const registerHeight = (parent.height - padding * (rowCount - 1)) / rowCount;

        const startX = parent.xOffset - parent.width / 2 + registerWidth / 2;
        const startY = parent.yOffset + parent.height / 2 - registerHeight / 2;

        const registers = new Map<string, MeshProperties>();

        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < columnCount; j++) {
                const xOffset = startX + j * (registerWidth + padding);
                const yOffset = startY - i * (registerHeight + padding);

                // Determine the index based on whether the grid is transposed
                const index = transposed ? j * rowCount + i : i * columnCount + j;
                const registerName = registerNames ? registerNames[index] : this.registerName(index);
                const register = {
                    width: registerWidth,
                    height: registerHeight,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    color: ComputerChip.COMPONENT_COLOR,
                };

                this.meshProperties.set(registerName, register);
                registers.set(registerName, register);
                const nameMesh = DrawUtils.buildTextMesh(registerName,
                    this.position.x + xOffset,
                    this.position.y + yOffset + register.height / 2 - DrawUtils.baseTextHeight / 4,
                    ComputerChip.TEXT_SIZE / 2, ComputerChip.BODY_COLOR);
                this.addTextMesh(this.registerNameTextMeshName(registerName), nameMesh);
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

            const pinName = this.pinName(i, side);
            const pin = (side === 'left' || side === 'right') ?
                DrawUtils.buildQuadrilateralMesh(ComputerChip.PIN_RADIUS * 2, ComputerChip.PIN_RADIUS,
                    ComputerChip.PIN_COLOR, {x: xOffset, y: yOffset}) :
                DrawUtils.buildQuadrilateralMesh(ComputerChip.PIN_RADIUS, ComputerChip.PIN_RADIUS * 2,
                    ComputerChip.PIN_COLOR, {x: xOffset, y: yOffset});

            pin.position.set(xOffset, yOffset, 0);
            pins.set(pinName, pin);
            this.pinPositions.set(pinName, new Vector2(xOffset, yOffset));
        }
        return pins;
    }

    protected buildTrace(pinPosition1: Vector2, side1: 'left' | 'right' | 'top' | 'bottom',
                         pinPosition2: Vector2, side2: 'left' | 'right' | 'top' | 'bottom', offset: number): Group {

        // Calculate extended start and end points
        const extendedStart = this.calculateExtendedPoint(pinPosition1, side1, offset);
        const extendedEnd = this.calculateExtendedPoint(pinPosition2, side2, 0.02);

        const intermediatePoint = new Vector2(extendedStart.x, extendedEnd.y);
        if (side1 === 'top' || side1 === 'bottom') {
            intermediatePoint.x = extendedEnd.x;
            intermediatePoint.y = extendedStart.y;
        }
        const startSegment = DrawUtils.buildLineMesh(pinPosition1, extendedStart, ComputerChip.PIN_COLOR);
        const horizontalSegment = DrawUtils.buildLineMesh(extendedStart, intermediatePoint, ComputerChip.PIN_COLOR);
        const verticalSegment = DrawUtils.buildLineMesh(intermediatePoint, extendedEnd, ComputerChip.PIN_COLOR);
        const endSegment = DrawUtils.buildLineMesh(extendedEnd, pinPosition2, ComputerChip.PIN_COLOR);

        // Group the segments
        const trace = new Group();
        trace.add(startSegment, horizontalSegment, verticalSegment, endSegment);

        return trace;
    }

    private calculateExtendedPoint(position: Vector2, side: 'left' | 'right' | 'top' | 'bottom', offset: number): Vector2 {
        switch (side) {
            case 'left':
                return new Vector2(position.x - offset, position.y);
            case 'right':
                return new Vector2(position.x + offset, position.y);
            case 'top':
                return new Vector2(position.x, position.y + offset);
            case 'bottom':
                return new Vector2(position.x, position.y - offset);
            default:
                return position;
        }
    }

    protected clearTextMeshes(...exceptions: string[]): void {
        const toDispose = [];
        this.meshes.forEach((mesh, componentName) => {
                if (!this.textMeshNames.includes(componentName) || exceptions.includes(componentName))
                    return;
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (mesh.material instanceof Material)
                    mesh.material.dispose();
                toDispose.push(componentName);
            }
        );
        toDispose.forEach(comp => {
            this.meshes.delete(comp);
            this.textMeshNames.splice(this.textMeshNames.indexOf(comp), 1);
        });
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

    resumeBlinks() {
        // Then, resume paused blinks for components that are not in the queue
        this.pausedBlinks.forEach((blinkMeshMaterial, componentName) => {
            if (!this.queuedBlinks.some(blinkAction => blinkAction.name === componentName)) {
                // Only resume blinks for components not affected by queued actions
                const remainingTime = this.getRemainingBlinkTime(componentName);
                this.changeComponentMesh(componentName, blinkMeshMaterial);

                if (remainingTime >= 0) {
                    const timeout = setTimeout(() => {
                        this.updateComponentMaterialToDefault(componentName);
                    }, remainingTime);

                    this.blinkStates.set(componentName, {timeout, startTime: Date.now(), duration: remainingTime});
                } else {
                    console.log("remaining time: " + remainingTime);
                    this.updateComponentMaterialToDefault(componentName);
                }
            }
        });
        this.pausedBlinks.clear();
        // First, execute all queued blink actions
        this.queuedBlinks.forEach(blinkAction => blinkAction());
        this.queuedBlinks = []; // Clear the queue after executing
    }

    pauseBlinks() {
        this.blinkStates.forEach((blinkInfo, componentName) => {
            clearTimeout(blinkInfo.timeout); // Clear existing timeout
            const blinkMeshMaterial = this.getMeshMaterial(componentName);
            this.pausedBlinks.set(componentName, blinkMeshMaterial);
            this.changeComponentMesh(componentName, blinkMeshMaterial);
        });
        this.blinkStates.clear(); // Clear blink states as they are paused
    }

    updateComponentMaterialToDefault(componentName: string) {
        if (this.meshProperties.has(componentName)) {
            this.changeComponentMesh(componentName, this.meshProperties.get(componentName).color);
        }
        this.blinkStates.delete(componentName);
    }

    getMeshMaterial(componentName: string) {
        return this.meshes.get(componentName).material as MeshBasicMaterial;
    }

    protected startBlink(componentName: string, newMesh: MeshBasicMaterial, blinkDuration: number) {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            this.updateComponentMaterialToDefault(componentName);
        }, blinkDuration);

        this.blinkStates.set(componentName, {timeout, startTime, duration: blinkDuration});
        this.changeComponentMesh(componentName, newMesh);
    }

    // Method to get the remaining time for a blink
    protected getRemainingBlinkTime(componentName: string): number {
        const blink = this.blinkStates.get(componentName);
        if (!blink) {
            return 0;
        }

        const elapsedTime = Date.now() - blink.startTime;
        return Math.max(blink.duration - elapsedTime, 0);
    }


    /**
     * Changes the color of a graphic component for a short period of time
     *
     * @param componentName the name of the component
     * @param newMesh the new color of the component
     * @param blinkDuration the duration of the blink in ms
     * @protected
     */
    protected highlight(componentName: string, newMesh: MeshBasicMaterial, blinkDuration?: number): void {
        const highlightAction = () => {
            // If there's already a blink for this component, clear it before starting a new one
            if (this.blinkStates.has(componentName)) {
                const existingBlink = this.blinkStates.get(componentName);
                clearTimeout(existingBlink.timeout);
                this.blinkStates.delete(componentName);
            }

            // Use the provided blinkDuration or default to a clock cycle duration
            const duration = blinkDuration ? blinkDuration : this.getClockCycleDuration();

            // Start the new blink
            this.startBlink(componentName, newMesh, duration);
        };

        if (this.paused) {
            // If the system is paused, queue the highlight action
            this.queuedBlinks.push(highlightAction);
        } else {
            // Otherwise, execute it immediately
            highlightAction();
        }
    }

    protected delay(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    protected initGraphics(): void {
        this.computeMeshProperties();
        this.addMeshesToScene()
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

    protected pinName(pinNumber: number, side: 'left' | 'right' | 'top' | 'bottom'): string {
        return `PIN${pinNumber}_${side.toUpperCase()}`;
    }

    protected registerName(registerNumber: number): string {
        return `R${registerNumber}`;
    }

    protected bufferMeshName(bufferName: string, index: number = 0): string {
        return `${bufferName}_BUFFER_${index}`;
    }

    protected bufferTextMeshName(bufferName: string, index: number): string {
        return `T_${bufferName}_BUFFER_${index}`;
    }

    protected registerNameTextMeshName(registerName: string): string {
        return `T_${registerName}`;
    }

    protected addTextMesh(name: string, mesh: Mesh): void {
        this.textMeshNames.push(name);
        this.meshes.set(name, mesh);
    }

    /**
     * Initializes the graphics of the chip
     * Is called in the constructor of all computer chips
     *
     * @protected
     */
    private addMeshesToScene(): void {
        this.meshProperties.forEach((_dims, name) => this.scene.add(this.addSimpleMesh(name)));
        this.textMeshNames.forEach(name => this.scene.add(this.meshes.get(name)));
        this.clockMesh.visible = false;
        this.selectedMesh = DrawUtils.buildQuadrilateralMesh(
            this.meshProperties.get(this.bodyMesh).width + 0.01,
            this.meshProperties.get(this.bodyMesh).height + 0.01,
            ComputerChip.HUD_TEXT_COLOR, {x: this.position.x, y: this.position.y});
        this.selectedMesh.position.set(this.position.x, this.position.y, 0);
        this.selectedMesh.renderOrder = -1;

        this.scene.add(this.clockMesh);
    }
}
