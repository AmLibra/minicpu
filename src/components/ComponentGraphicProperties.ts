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
