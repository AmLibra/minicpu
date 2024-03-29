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
     */
    constructor(scene: Scene, text: string, position: Vector2, onClick: () => void) {
        super(scene);
        this.mesh = DrawUtils.buildTextMesh(text, position.x, position.y, HUD.TEXT_SIZE, HUD.BASE_COLOR, false);
        this.mesh.geometry.center();
        this.mesh.geometry.computeBoundingBox();
        this.hitbox = DrawUtils.buildQuadrilateralMesh(
            this.mesh.geometry.boundingBox.max.x - this.mesh.geometry.boundingBox.min.x,
            this.mesh.geometry.boundingBox.max.y - this.mesh.geometry.boundingBox.min.y,
            HUD.BASE_COLOR, position);
        this.hitbox.geometry.center();
        this.hitbox.visible = false;
        scene.add(this.mesh, this.hitbox);
        this.onClick = () => onClick();
        this.onHover = () => this.mesh.material = HUD.HOVER_COLOR;
        this.onUnhover = () => this.mesh.material = HUD.BASE_COLOR;
    }

    public getHitbox(): Mesh {
        return this.hitbox;
    }
}