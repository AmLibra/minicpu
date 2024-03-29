import {Mesh, Scene} from "three";

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
        if (this.onClick === undefined)
            return false;
        return true;
    }

    /**
     * Returns whether the button is hoverable.
     */
    public isHoverable(): boolean {
        if (this.onHover === undefined || this.onUnhover === undefined)
            return false;
        return true;
    }
}