import {Material, MeshBasicMaterial} from "three";

/**
 * ComponentGraphicProperties
 *
 * This class is used to store the properties of a component's graphic representation.
 *
 * @class MeshProperties
 * @constructor
 * @param {number} width - The width of the component
 * @param {number} height - The height of the component
 * @param {number} x - The x offset of the component
 * @param {number} y - The y offset of the component
 * @param {string} color - The color of the component
 */
export class MeshProperties {
    public width: number;
    public height: number;
    public xOffset: number;
    public yOffset: number;
    public color: MeshBasicMaterial;
    public immutable: boolean = false;

    constructor(width: number, height: number, x: number, y: number, color: MeshBasicMaterial, immutable?: boolean) {
        this.width = width;
        this.height = height;
        this.xOffset = x;
        this.yOffset = y;
        this.color = color;
        this.immutable = immutable;
    }
}
