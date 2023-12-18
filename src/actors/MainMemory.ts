import {ComputerChip} from "./ComputerChip";
import {Scene} from "three";

export class MainMemory extends ComputerChip {
    public static readonly WIDTH: number = 1.2;
    public static readonly HEIGHT: number = 1.2;
    public static readonly COMPONENTS_INNER_MARGIN = 0.03;
    public static readonly COMPONENTS_SPACING = 0.02;
    public static readonly SIZE: number = 16;

    constructor(id: string, position: [number, number], scene: Scene) {
        super(id, position, scene);
    }

    draw(): void {
        throw new Error("Method not implemented.");
    }
    update(): void {
        throw new Error("Method not implemented.");
    }
}