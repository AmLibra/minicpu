import {BufferGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

export enum Side {
    LEFT,
    RIGHT,
    TOP,
    BOTTOM
}


/**
 * Abstract class for computer chips
 * @abstract
 * @class
 * @property {string} id The id of the chip
 * @property {{x: number, y: number}} position The position of the chip
 * @property {Scene} scene The scene to add the chip to
 */
export abstract class ComputerChip {
    protected static readonly TEXT_SIZE: number = 0.05;
    protected static readonly PIN_MARGIN = 0.05;
    protected static readonly PIN_WIDTH = 0.02;

    protected static readonly CONTENTS_MARGIN = 0.03;
    protected static readonly INNER_SPACING = 0.01;

    protected static readonly BODY_MATERIAL: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly HUD_TEXT_MATERIAL: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    protected static readonly PIN_MATERIAL: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});

    protected bodyMesh: Mesh;
    protected selectedMesh: Mesh;
    protected clockMesh: Mesh;

    public readonly pinPositions: Map<Side, Vector2[]>;

    public readonly scene: Scene;
    readonly position: { x: number; y: number };
    protected clockFrequency: number = 1;

    protected paused: boolean = false;

    protected constructor(position: [number, number], scene: Scene, clockFrequency: number) {
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.clockFrequency = clockFrequency;
        this.pinPositions = new Map<Side, Vector2[]>();
    }

    /**
     * Returns the display name of the chip
     *
     * @returns {string} The display name
     */
    abstract displayName(): string;

    /**
     * Updates the chip
     * Is called in the update loop of all computer chips
     *
     * @protected
     */
    abstract update(): void;

    /**
     * Returns the clock frequency of the chip
     *
     * @returns {number} The clock frequency
     */
    public getClockFrequency(): number {
        return this.clockFrequency;
    }

    public getHitBoxMesh(): Mesh {
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

    protected drawPins(parent: Mesh, side: Side, pinCount: number): void {
        let startX: number;
        let startY: number;
        let pinSpacing: number;
        const width = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.width : 0;
        const height = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.height : 0;
        const spaceToFillHorizontal = width - 2 * ComputerChip.PIN_MARGIN;
        const spaceToFillVertical = height - 2 * ComputerChip.PIN_MARGIN;

        const pinGeometries: BufferGeometry[] = [];
        this.pinPositions.set(side, []);

        switch (side) {
            case Side.LEFT:
            case Side.RIGHT:
                startX = side == Side.LEFT ? this.position.x - width / 2 - ComputerChip.PIN_WIDTH - 0.01 :
                    this.position.x + width / 2 + ComputerChip.PIN_WIDTH + 0.01;
                startY = this.position.y + height / 2 - ComputerChip.PIN_MARGIN - ComputerChip.PIN_WIDTH;
                pinSpacing = (spaceToFillVertical - pinCount * (2 * ComputerChip.PIN_WIDTH)) / (pinCount - 1);
                break;
            case Side.TOP:
            case Side.BOTTOM:
                startY = side == Side.TOP ? this.position.y + height / 2 + ComputerChip.PIN_WIDTH + 0.01 :
                    this.position.y - height / 2 - ComputerChip.PIN_WIDTH - 0.01;
                startX = this.position.x - width / 2 + ComputerChip.PIN_MARGIN + ComputerChip.PIN_WIDTH;
                pinSpacing = (spaceToFillHorizontal - pinCount * (2 * ComputerChip.PIN_WIDTH)) / (pinCount - 1);
                break;
        }
        // Create and place pins
        for (let i = 0; i < pinCount; i++) {
            const xOffset = side == Side.LEFT || side == Side.RIGHT ?
                startX : startX + i * (2 * ComputerChip.PIN_WIDTH + pinSpacing);
            const yOffset = side == Side.LEFT || side == Side.RIGHT ?
                startY - i * (2 * ComputerChip.PIN_WIDTH + pinSpacing) : startY;

            const longSide = ComputerChip.PIN_WIDTH * 2;
            const shortSide = ComputerChip.PIN_WIDTH;
            const pinGeometry = (side == Side.LEFT || side == Side.RIGHT) ?
                new PlaneGeometry(longSide, shortSide) : new PlaneGeometry(shortSide, longSide);

            pinGeometry.translate(xOffset, yOffset, 0);
            pinGeometries.push(pinGeometry);
            this.pinPositions.get(side).push(new Vector2(xOffset, yOffset));
        }
        // Merge pin geometries
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(pinGeometries, true);
        if (!mergedGeometry)
            throw new Error("Failed to merge geometries");

        this.scene.add(new Mesh(mergedGeometry, ComputerChip.PIN_MATERIAL));
    }

    protected drawTraces(thisSide: Side, other: ComputerChip, otherSide: Side, baseOffset: number, pinSpacing: number, dimension: 'x' | 'y'): void {
        const halfwayPoint = this.findClosestPinToCentralPin(thisSide, other, otherSide, dimension);
        const size = other.pinPositions.get(otherSide).length;
        const traces = new Group();
        for (let i = 0; i < size; ++i) {
            const offset = i < halfwayPoint ? baseOffset + (pinSpacing * i) :
                baseOffset + (pinSpacing * (halfwayPoint + 1)) - (pinSpacing * (i - halfwayPoint));
            traces.add(this.buildTrace(this.pinPositions.get(thisSide)[i], thisSide,
                other.pinPositions.get(otherSide)[i], otherSide, offset));
        }
        this.scene.add(traces);
    }

    protected findClosestPinToCentralPin(thisSide: Side, other: ComputerChip, otherSide: Side, dimension: 'x' | 'y'): number {
        const centralPinIndex = Math.floor(this.pinPositions.get(thisSide).length / 2);
        const centralPinPosition = this.pinPositions.get(thisSide)[centralPinIndex][dimension];

        let closestPinIndex = 0;
        let smallestDistance = Number.MAX_VALUE;

        const otherPins = other.pinPositions.get(otherSide);
        for (let i = 0; i < otherPins.length; ++i) {
            const distance = Math.abs(otherPins[i][dimension] - centralPinPosition);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                closestPinIndex = i;
            }
        }

        return closestPinIndex;
    }

    protected buildTrace(pinPosition1: Vector2, side1: Side, pinPosition2: Vector2, side2: Side, offset: number): Group {
        // Calculate extended start and end points
        const extendedStart = this.calculateExtendedPoint(pinPosition1, side1, offset);
        const extendedEnd = this.calculateExtendedPoint(pinPosition2, side2, 0.02);
        const intermediatePoint = new Vector2(extendedStart.x, extendedEnd.y);

        if (side1 == Side.TOP || side1 == Side.BOTTOM) {
            intermediatePoint.x = extendedEnd.x;
            intermediatePoint.y = extendedStart.y;
        }
        const startSegment = DrawUtils.buildLineMesh(pinPosition1, extendedStart, ComputerChip.PIN_MATERIAL.color);
        const horizontalSegment = DrawUtils.buildLineMesh(extendedStart, intermediatePoint, ComputerChip.PIN_MATERIAL.color);
        const verticalSegment = DrawUtils.buildLineMesh(intermediatePoint, extendedEnd, ComputerChip.PIN_MATERIAL.color);
        const endSegment = DrawUtils.buildLineMesh(extendedEnd, pinPosition2, ComputerChip.PIN_MATERIAL.color);

        // Group the segments
        const trace = new Group();
        trace.add(startSegment, horizontalSegment, verticalSegment, endSegment);

        return trace;
    }

    private calculateExtendedPoint(position: Vector2, side: Side, offset: number): Vector2 {
        switch (side) {
            case Side.LEFT:
                return new Vector2(position.x - offset, position.y);
            case Side.RIGHT:
                return new Vector2(position.x + offset, position.y);
            case Side.TOP:
                return new Vector2(position.x, position.y + offset);
            case Side.BOTTOM:
                return new Vector2(position.x, position.y - offset);
            default:
                return position;
        }
    }

    protected buildBodyMesh(bodyWidth: number, bodyHeight: number): void {
        this.bodyMesh = new Mesh(new PlaneGeometry(bodyWidth, bodyHeight), ComputerChip.BODY_MATERIAL);
        this.bodyMesh.position.set(this.position.x, this.position.y, 0);

        this.clockMesh = DrawUtils.buildTextMesh(DrawUtils.formatFrequency(this.clockFrequency),
            this.position.x, this.position.y + bodyHeight / 2 + ComputerChip.TEXT_SIZE,
            ComputerChip.TEXT_SIZE, ComputerChip.HUD_TEXT_MATERIAL);
        this.clockMesh.visible = false;

        this.scene.add(this.bodyMesh, this.clockMesh);
        this.buildSelectedMesh();
    }

    protected buildSelectedMesh(): void {
        const bodyHeight = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.height : 0;
        const bodyWidth = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.width : 0;
        this.selectedMesh = new Mesh(new PlaneGeometry(bodyWidth + 0.01, bodyHeight + 0.01), ComputerChip.HUD_TEXT_MATERIAL);
        this.selectedMesh.position.set(this.position.x, this.position.y, -0.01);
    }
}
