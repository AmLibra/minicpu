import {Mesh, Scene, Vector2} from "three";

export abstract class Button {
    public readonly onHover: () => void;
    public readonly onClick: () => void;
    public readonly onUnhover: () => void;

    protected hitbox: Mesh;
    protected readonly scene: Scene;
    protected readonly position: Vector2;

    protected constructor(scene: Scene, onClick?: () => void, onHover?: () => void, onUnhover?: () => void) {
        this.scene = scene;
        this.onHover = onHover;
        this.onClick = onClick;
        this.onUnhover = onUnhover;
    }

    public isHoverable(): boolean {
        if (this.onHover === undefined) {
            throw new Error("onHover is not defined");
        }
        if (this.onUnhover === undefined) {
            throw new Error("onUnhover is not defined");
        }
        return true;
    }

    public getHitbox(): Mesh {
        return this.hitbox;
    }
}