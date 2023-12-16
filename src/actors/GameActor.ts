import {Scene} from "three";

export abstract class GameActor {
    protected readonly position: { x: number; y: number };

    protected constructor(position: [number, number]) {
        this.position = {x: position[0], y: position[1]};
    }

    abstract draw(): void;

    abstract update(): void;

}
