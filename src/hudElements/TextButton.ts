import {AbstractButton} from "./AbstractButton";
import {Mesh, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import {HUD} from "../HUD";

/**
 * The most basic button that can be created, based a text mesh. Supports hover and click events.
 */
export class TextButton extends AbstractButton {
    private readonly hitbox: Mesh;
    mesh: Mesh;

    /**
     * Creates a new text button.
     *
     * @param scene The scene to add the button to.
     * @param text The text of the button.
     * @param position The position of the button.
     * @param onClick The function to execute when the button is clicked.
     * @param textSize The size of the text.
     * @param centered Whether the text should be centered.
     */
    constructor(scene: Scene, text: string, position: Vector2, onClick: () => void, textSize: number = HUD.TEXT_SIZE, centered: boolean = true) {
        super(scene);
        this.mesh = DrawUtils.buildTextMesh(text, position.x, position.y, textSize, HUD.BASE_COLOR, centered);
        this.mesh.geometry.computeBoundingBox();
        if (this.mesh.geometry.boundingBox === null)
            throw new Error("Bounding box is null");

        this.hitbox = DrawUtils.buildQuadrilateralMesh(
            this.mesh.geometry.boundingBox.max.x - this.mesh.geometry.boundingBox.min.x,
            this.mesh.geometry.boundingBox.max.y - this.mesh.geometry.boundingBox.min.y,
            HUD.BASE_COLOR, new Vector2(position.x, position.y));
        if (!centered) {
            this.mesh.geometry.computeBoundingBox();
            this.hitbox.position.set(position.x + (this.mesh.geometry.boundingBox.max.x - this.mesh.geometry.boundingBox.min.x) / 2 + 0.01,
                position.y + (this.mesh.geometry.boundingBox.max.y - this.mesh.geometry.boundingBox.min.y) / 2 - 0.005, 0);
        }

        this.hitbox.visible = false;
        scene.add(this.mesh, this.hitbox);
        this.onClick = () => onClick();
        this.onHover = () => this.mesh.material = HUD.HOVER_COLOR;
        this.onUnhover = () => this.mesh.material = HUD.BASE_COLOR;
    }

    public getHitbox(): Mesh {
        return this.hitbox;
    }

    public dispose(): void {
        this.scene.remove(this.mesh, this.hitbox);
    }
}