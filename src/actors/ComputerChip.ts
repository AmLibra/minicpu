import {
    BufferGeometry,
    Group,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Scene,
    Vector2,
    Vector3
} from "three";
import {DrawUtils} from "../DrawUtils";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";

/**
 * Enumeration for the sides of a computer chip
 * @enum
 */
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

    /** The color palette used for the computer chip */
    protected static readonly BODY_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("DARK")});
    protected static readonly HUD_TEXT_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});
    protected static readonly PIN_MATERIAL: MeshBasicMaterial = new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});

    protected static readonly MAX_CLOCK_FREQUENCY = 120;
    // The basic meshes of a computer chip
    protected bodyMesh: Mesh | undefined;
    protected selectedMesh: Mesh | undefined;

    // The positions of the pins on the chip per side
    public readonly pinPositions: Map<Side, Vector2[]>;
    public readonly pinGeometries: Map<Side, BufferGeometry[]>;
    private readonly pinsMeshes: Map<Side, Mesh>;
    private readonly traces: Map<Side, Group>;

    public readonly scene: Scene;
    position: { x: number; y: number };
    private clockFrequency: number = 1;
    protected chipMenuOptions: ChipMenuOptions;

    /**
     * @constructor
     * @param {number[]} position The position of the chip
     * @param {Scene} scene The scene to add the chip to
     * @param {number} clockFrequency The clock frequency of the chip
     */
    protected constructor(position: [number, number], scene: Scene, clockFrequency: number) {
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.clockFrequency = clockFrequency;
        this.pinPositions = new Map<Side, Vector2[]>();
        this.pinGeometries = new Map<Side, BufferGeometry[]>();
        this.pinsMeshes = new Map<Side, Mesh>();
        this.traces = new Map<Side, Group>();
    }

    /**
     * Returns the display name of the chip
     *
     * @returns {string} The display name
     * @protected
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
     * Initializes the graphics of the chip
     *
     * @protected
     */
    abstract initializeGraphics(): void;

    /**
     * Returns the chip menu options
     *
     * @returns {ChipMenuOptions} The menu options
     * @protected
     */
    abstract getMenuOptions(): ChipMenuOptions;

    /**
     * Returns the clock frequency of the chip
     *
     * @returns {number} The clock frequency
     */
    public getClockFrequency(): number {
        return this.clockFrequency;
    }

    /**
     * Gets the hit box mesh of the chip
     */
    public getHitBoxMesh(): Mesh {
        return this.bodyMesh!;
    }

    /**
     * Selects the chip and shows the selected mesh
     */
    public select(): ComputerChip {
        this.scene.add(this.selectedMesh!);
        return this;
    }

    /**
     * Deselects the chip and hides the selected mesh
     */
    public deselect(): undefined {
        this.scene.remove(this.selectedMesh!);
        return undefined;
    }

    /**
     * Draws the pins of the chip
     * @param parent The parent mesh to draw the pins on
     * @param side The side to draw the pins on
     * @param pinCount The number of pins to draw
     * @protected
     */
    protected drawPins(parent: Mesh, side: Side, pinCount: number): void {
        const width = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.width : 0;
        const height = parent.geometry instanceof PlaneGeometry ? parent.geometry.parameters.height : 0;
        const horizontal = side === Side.TOP || side === Side.BOTTOM;

        const spaceToFill = horizontal ? width - 2 * ComputerChip.PIN_MARGIN : height - 2 * ComputerChip.PIN_MARGIN;
        const pinSpacing = (spaceToFill - pinCount * (2 * ComputerChip.PIN_WIDTH)) / (pinCount - 1);
        this.pinPositions.set(side, []);
        this.pinGeometries.set(side, []);

        for (let i = 0; i < pinCount; i++) {
            const offset = i * (2 * ComputerChip.PIN_WIDTH + pinSpacing);
            const xOffset = horizontal ?
                this.position.x - width / 2 + ComputerChip.PIN_MARGIN + ComputerChip.PIN_WIDTH + offset :
                (side === Side.LEFT ? this.position.x - width / 2 - ComputerChip.PIN_WIDTH - 0.01 : this.position.x + width / 2 + ComputerChip.PIN_WIDTH + 0.01);
            const yOffset = horizontal ?
                (side === Side.TOP ? this.position.y + height / 2 + ComputerChip.PIN_WIDTH + 0.01 : this.position.y - height / 2 - ComputerChip.PIN_WIDTH - 0.01)
                : this.position.y - height / 2 + ComputerChip.PIN_MARGIN + ComputerChip.PIN_WIDTH + offset;

            const pinGeometry = new PlaneGeometry(ComputerChip.PIN_WIDTH, ComputerChip.PIN_WIDTH * 2);
            if (!horizontal) pinGeometry.rotateZ(Math.PI / 2); // Rotate for left/right sides
            pinGeometry.translate(xOffset, yOffset, 0);
            this.pinGeometries.get(side)!.push(pinGeometry);
            this.pinPositions.get(side)!.push(new Vector2(xOffset, yOffset));
        }
        // Merge pin geometries and add to the scene
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(this.pinGeometries.get(side)!);
        if (!mergedGeometry) throw new Error("Failed to merge geometries");
        const mergedMesh = new Mesh(mergedGeometry, ComputerChip.PIN_MATERIAL);
        this.scene.add(mergedMesh);
        this.pinsMeshes.set(side, mergedMesh);
    }

    /**
     * Builds a trace between two pins
     *
     * @param pinPosition1 The position of the first pin
     * @param side1 The side of the first pin
     * @param pinPosition2 The position of the second pin
     * @param side2 The side of the second pin
     * @param offset The offset of the trace
     * @param material The material of the trace, optional
     * @protected
     */
    protected buildTrace(pinPosition1: Vector2, side1: Side, pinPosition2: Vector2, side2: Side, offset: number, material ?: MeshBasicMaterial): Line {
        // Calculate extended start and end points
        const extendedStart = this.calculateExtendedPoint(pinPosition1, side1, offset);
        const extendedEnd = this.calculateExtendedPoint(pinPosition2, side2, ComputerChip.PIN_WIDTH * 2);
        const intermediatePoint = new Vector2(
            side1 === Side.TOP || side1 === Side.BOTTOM ? extendedEnd.x : extendedStart.x,
            side1 === Side.TOP || side1 === Side.BOTTOM ? extendedStart.y : extendedEnd.y
        );

        // Create merged geometry for all line segments
        const points = [
            new Vector3(pinPosition1.x, pinPosition1.y, 0), // Start to extended start
            new Vector3(extendedStart.x, extendedStart.y, 0), // Extended start to intermediate

            new Vector3(intermediatePoint.x, intermediatePoint.y, 0), // Intermediate to extended end

            new Vector3(extendedEnd.x, extendedEnd.y, 0), // Extended end to end
            new Vector3(pinPosition2.x, pinPosition2.y, 0)
        ];

        const geometry = new BufferGeometry().setFromPoints(points);
        const lineMaterial = new LineBasicMaterial({color: material ? material.color : ComputerChip.PIN_MATERIAL.color});
        return new Line(geometry, lineMaterial);
    }

    /**
     * Draws a trace between two pins
     *
     * @param index The index of the pin
     * @param material The material of the trace
     * @param thisSide The side of the current chip
     * @param other The other chip
     * @param otherSide The side of the other chip
     * @param baseOffset The base offset for the trace
     * @param pinSpacing The spacing between the pins
     * @param dimension The dimension to draw the trace in
     * @protected
     */
    protected drawTrace(index: number, material: MeshBasicMaterial, thisSide: Side, other: ComputerChip,
                        otherSide: Side, baseOffset: number, pinSpacing: number, dimension: 'x' | 'y'): Line {
        const thisPins = this.pinPositions.get(thisSide)!;
        const otherPins = other.pinPositions.get(otherSide)!;
        let startIndexThisSide = 0;
        let startIndexOtherSide = 0;

        if (thisPins[startIndexThisSide][dimension] >= otherPins[startIndexOtherSide][dimension]) {
            startIndexThisSide = thisPins.length - 1;
        } else if (thisPins[startIndexThisSide][dimension] < otherPins[startIndexOtherSide][dimension]) {
            startIndexOtherSide = otherPins.length - 1;
        }

        let adjustedIndexThisSide = index >= startIndexThisSide ? index : startIndexThisSide - (startIndexThisSide - index);
        let adjustedIndexOtherSide = index >= startIndexOtherSide ? index : startIndexOtherSide - (startIndexOtherSide - index);
        adjustedIndexThisSide = Math.min(adjustedIndexThisSide, thisPins.length - 1);
        adjustedIndexOtherSide = Math.min(adjustedIndexOtherSide, otherPins.length - 1);
        const offset = dimension === 'x' ?
            baseOffset + (pinSpacing * (thisPins.length - 1) - pinSpacing * Math.abs(adjustedIndexThisSide - startIndexThisSide))
            : baseOffset + (pinSpacing * Math.abs(adjustedIndexThisSide - startIndexThisSide));

        return this.buildTrace(thisPins[adjustedIndexThisSide], thisSide, otherPins[adjustedIndexOtherSide], otherSide, offset, material);
    }

    /**
     * Draws the traces between the pins of two chips
     *
     * @param thisSide The side of the current chip
     * @param other The other chip
     * @param otherSide The side of the other chip
     * @param baseOffset The base offset for the traces
     * @param pinSpacing The spacing between the pins
     * @param dimension The dimension to draw the traces in
     * @protected
     */
    protected drawTraces(thisSide: Side, other: ComputerChip, otherSide: Side, baseOffset: number, pinSpacing: number, dimension: 'x' | 'y'): void {
        const traces = new Group();
        for (let i = 0; i < this.pinPositions.get(thisSide)!.length; i++)
            traces.add(this.drawTrace(i, ComputerChip.PIN_MATERIAL, thisSide, other, otherSide, baseOffset, pinSpacing, dimension));
        this.traces.set(thisSide, traces);
        this.scene.add(traces);
    }

    /**
     * Clears the traces and pins for a given side
     *
     * @param side The side to clear
     * @protected
     */
    protected clearTracesAndPins(side: Side): void {
        if (!this.pinsMeshes.get(side)) return;
        DrawUtils.disposeMesh(this.pinsMeshes.get(side)!);
        this.scene.remove(this.pinsMeshes.get(side)!);
        if (!this.traces.get(side)) return;
        this.scene.remove(this.traces.get(side)!);
        this.traces.get(side)!?.children.forEach(trace => DrawUtils.disposeMesh(trace as Mesh));
    }

    /**
     * Calculates the extended point for a given position and side, which is used to draw traces
     * @param position The position to extend
     * @param side The side to extend to
     * @param length The length to extend by
     * @private
     */
    private calculateExtendedPoint(position: Vector2, side: Side, length: number): Vector2 {
        switch (side) {
            case Side.LEFT:
                return new Vector2(position.x - length, position.y);
            case Side.RIGHT:
                return new Vector2(position.x + length, position.y);
            case Side.TOP:
                return new Vector2(position.x, position.y + length);
            case Side.BOTTOM:
                return new Vector2(position.x, position.y - length);
            default:
                return position;
        }
    }

    /**
     * Builds the body mesh of the chip
     *
     * @protected
     * @param {number} bodyWidth The width of the body
     * @param {number} bodyHeight The height of the body
     */
    protected buildBodyMesh(bodyWidth: number, bodyHeight: number): void {
        this.bodyMesh = new Mesh(new PlaneGeometry(bodyWidth, bodyHeight), ComputerChip.BODY_MATERIAL);
        this.bodyMesh.position.set(this.position.x, this.position.y, 0);
        this.scene.add(this.bodyMesh);
        this.buildSelectedMesh();
    }

    protected disposeBodyMesh(): void {
        if (!this.bodyMesh || !this.selectedMesh) return;
        this.scene.remove(this.bodyMesh);
        this.scene.remove(this.selectedMesh);
        DrawUtils.disposeMesh(this.bodyMesh);
        DrawUtils.disposeMesh(this.selectedMesh);
        this.bodyMesh = undefined;
        this.selectedMesh = undefined;
    }

    /**
     * Updates the clock frequency of the chip
     *
     * @protected
     * @param {number} newValue The new clock frequency
     */
    protected updateClock(newValue: number): number {
        this.clockFrequency = newValue;
        return this.clockFrequency;
    }

    /**
     * Builds the selected mesh, which is a slightly larger mesh that is used to indicate that the chip is selected
     *
     * @protected
     */
    private buildSelectedMesh(): void {
        if (!this.bodyMesh) return;
        const bodyHeight = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.height : 0;
        const bodyWidth = this.bodyMesh.geometry instanceof PlaneGeometry ? this.bodyMesh.geometry.parameters.width : 0;
        this.selectedMesh = new Mesh(new PlaneGeometry(bodyWidth + 0.01, bodyHeight + 0.01), ComputerChip.HUD_TEXT_MATERIAL);
        this.selectedMesh.position.set(this.position.x, this.position.y, -0.01);
    }
}