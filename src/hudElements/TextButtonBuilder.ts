import {Scene, Vector2} from "three";
import {TextButton} from "./TextButton";

/**
 * A builder for text buttons.
 */
export class TextButtonBuilder {

    private scene: Scene;
    private text: string;
    private position: Vector2;
    private onClick: () => void;
    private textSize: number;
    private centered: boolean;

    /**
     * Constructs a new TextButtonBuilder instance.
     */
    constructor() {
    }

    /**
     * Builds a new TextButton instance.
     *
     * @return the new TextButton instance
     */
    public build(): TextButton {
        return new TextButton(this.scene, this.text, this.position, this.onClick, this.textSize, this.centered);
    }

    /**
     * Sets the scene for the text button.
     *
     * @param scene the scene to set
     */
    public withScene(scene: Scene): TextButtonBuilder {
        this.scene = scene;
        return this;
    }


    /**
     * Sets the text for the text button.
     *
     * @param text the text to set
     */
    public withText(text: string): TextButtonBuilder {
        this.text = text;
        return this;
    }

    /**
     * Sets the position for the text button.
     *
     * @param position the position to set
     */
    public withPosition(position: Vector2): TextButtonBuilder {
        this.position = position;
        return this;
    }

    /**
     * Sets the onClick for the text button.
     *
     * @param onClick the onClick to set
     */
    public withOnClick(onClick: () => void): TextButtonBuilder {
        this.onClick = onClick;
        return this;
    }

    /**
     * Sets the textSize for the text button.
     *
     * @param textSize the textSize to set
     */
    public withTextSize(textSize: number): TextButtonBuilder {
        this.textSize = textSize;
        return this;
    }

    /**
     * Sets the centered for the text button.
     *
     * @param centered the centered to set
     */
    public withCentered(centered: boolean): TextButtonBuilder {
        this.centered = centered;
        return this;
    }
}