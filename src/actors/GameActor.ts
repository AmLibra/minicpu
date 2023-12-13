import {Scene} from "three";

export abstract class GameActor {
    private readonly position: [number, number];

    protected constructor(position: [number, number]) {
        this.position = position
    }

    abstract draw(scene: Scene): void;

    abstract update(): void;

    public get_position(): [number, number] {
        return this.position
    }
}
