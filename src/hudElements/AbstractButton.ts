import {Mesh, Scene} from "three";
import {DrawUtils} from "../DrawUtils";

/**
 * Abstract class for buttons used in the Heads-Up Display.
 */
export abstract class AbstractButton {
    /** Expectable Button functions */
    public onHover: () => void;
    public onUnhover: () => void;
    public onClick: () => void;

    protected constructor(protected readonly scene: Scene) {}

    /**
     * Returns the hitbox of the button.
     */
    public abstract getHitbox(): Mesh;

    /**
     * Returns whether the button is clickable.
     */
    public isClickable(): boolean {
        return this.onClick !== undefined;
    }

    /**
     * Returns whether the button is hoverable.
     */
    public isHoverable(): boolean {
        return !(this.onHover === undefined || this.onUnhover === undefined);
    }

    public destroy() {
        this.scene.remove(this.getHitbox());
        DrawUtils.disposeMesh(this.getHitbox());
    }
}