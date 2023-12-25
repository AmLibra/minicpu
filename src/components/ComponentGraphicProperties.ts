/**
 * ComponentGraphicProperties
 *
 * This class is used to store the properties of a component's graphic representation.
 *
 * @class ComponentGraphicProperties
 * @constructor
 * @param {number} width - The width of the component
 * @param {number} height - The height of the component
 * @param {number} x - The x offset of the component
 * @param {number} y - The y offset of the component
 * @param {string} color - The color of the component
 */
export class ComponentGraphicProperties {
    public width: number;
    public height: number;
    public xOffset: number;
    public yOffset: number;
    public color: string;

    constructor(width: number, height: number, x: number, y: number, color: string) {
        this.width = width;
        this.height = height;
        this.xOffset = x;
        this.yOffset = y;
        this.color = color;
    }
}
