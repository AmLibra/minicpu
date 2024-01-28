import {Group, Material, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import {MeshProperties} from "../components/MeshProperties";

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

    protected static readonly CONTENTS_MARGIN = 0.03;
    protected static readonly INNER_SPACING = 0.01;
    protected static readonly WORD_SIZE = 6; // bytes
    static readonly MAX_BYTE_VALUE = 8;

    protected static readonly BODY_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly HUD_TEXT_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});

    protected static readonly PIN_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});

    protected readonly meshProperties: Map<string, MeshProperties>;
    protected readonly meshes: Map<string, Mesh>;
    protected readonly textMeshNames: Array<string>;

    protected bodyMesh: Mesh;
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
    }

    abstract displayName(): string;

    /**
     * Updates the chip
     * Is called in the update loop of all computer chips
     *
     * @protected
     */
    abstract update(): void;

    public togglePauseState() {
        this.paused = !this.paused;
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
        return this.bodyMesh;
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

    protected drawPins(parent: Mesh, side: 'left' | 'right' | 'top' | 'bottom', pinCount: number): Map<string, Mesh> {
        const pins = new Map<string, Mesh>();
        let startX: number;
        let startY: number;
        let pinSpacing: number;
        const width = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.width : 0;
        const height = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.height : 0;

        const spaceToFillHorizontal = width - 2 * ComputerChip.PIN_MARGIN;
        const spaceToFillVertical = height - 2 * ComputerChip.PIN_MARGIN;

        switch (side) {
            case 'left':
            case 'right':
                startX = side === 'left' ? this.position.x - width / 2 - ComputerChip.PIN_RADIUS - 0.01 :
                    this.position.x + width / 2 + ComputerChip.PIN_RADIUS + 0.01;
                startY = this.position.y + height / 2 - ComputerChip.PIN_MARGIN - ComputerChip.PIN_RADIUS;
                pinSpacing = (spaceToFillVertical - pinCount * (2 * ComputerChip.PIN_RADIUS)) / (pinCount - 1);
                break;
            case 'top':
            case 'bottom':
                startY = side === 'top' ? this.position.y + height / 2 + ComputerChip.PIN_RADIUS + 0.01 :
                    this.position.y - height / 2 - ComputerChip.PIN_RADIUS - 0.01;
                startX = this.position.x - width / 2 + ComputerChip.PIN_MARGIN + ComputerChip.PIN_RADIUS;
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
        const startSegment = DrawUtils.buildLineMesh(pinPosition1, extendedStart, ComputerChip.PIN_COLOR.color);
        const horizontalSegment = DrawUtils.buildLineMesh(extendedStart, intermediatePoint, ComputerChip.PIN_COLOR.color);
        const verticalSegment = DrawUtils.buildLineMesh(intermediatePoint, extendedEnd, ComputerChip.PIN_COLOR.color);
        const endSegment = DrawUtils.buildLineMesh(extendedEnd, pinPosition2, ComputerChip.PIN_COLOR.color);

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


    protected pinName(pinNumber: number, side: 'left' | 'right' | 'top' | 'bottom'): string {
        return `PIN${pinNumber}_${side.toUpperCase()}`;
    }

    protected registerName(registerNumber: number): string {
        return `R${registerNumber}`;
    }

    protected buildBodyMesh(bodyWidth: number, bodyHeight: number): void {

        this.bodyMesh = new Mesh(new PlaneGeometry(bodyWidth, bodyHeight), ComputerChip.BODY_COLOR);
        this.bodyMesh.position.set(this.position.x, this.position.y, 0);

        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x, this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.HUD_TEXT_COLOR);
        this.clockMesh.visible = false;

        this.scene.add(this.bodyMesh, this.clockMesh);
        this.buildSelectedMesh();
    }

    protected buildSelectedMesh(): void {
        const bodyHeight = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.height : 0;
        const bodyWidth = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.width : 0;
        this.selectedMesh = new Mesh(new PlaneGeometry(bodyWidth + 0.01, bodyHeight + 0.01), ComputerChip.HUD_TEXT_COLOR);
        this.selectedMesh.position.set(this.position.x, this.position.y, -0.01);
    }
}
