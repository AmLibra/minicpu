import {AbstractButton} from "./AbstractButton";
import {Mesh, MeshBasicMaterial, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import {HUD} from "../HUD";

/**
 * Button to pause and play the game.
 */
export class PauseButton extends AbstractButton {
    private readonly pauseMesh: Mesh;
    private readonly playMesh: Mesh;
    private isPaused: boolean = true;

    /**
     * Creates a new pause button.
     *
     * @param scene The scene to add the button to.
     * @param position The position of the button.
     * @param material The material of the button.
     * @param togglePause The function to toggle the pause state.
     */
    constructor(scene: Scene, position: Vector2, material: MeshBasicMaterial, togglePause: () => void) {
        super(scene);
        this.pauseMesh = DrawUtils.buildTriangleMesh(0.1, material)
                                  .translateX(position.x).translateY(position.y)
                                  .rotateZ(-Math.PI / 2);

        this.playMesh = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, material, position);
        this.playMesh.visible = false;

        this.scene.add(this.pauseMesh, this.playMesh);

        this.onClick = () => {
            this.isPaused = !this.isPaused;
            this.pauseMesh.visible = this.isPaused;
            this.playMesh.visible = !this.isPaused;
            togglePause();
        }

        this.onHover = () => {
            let mesh = this.isPaused ? this.pauseMesh : this.playMesh;
            PauseButton.changeMeshAppearance(mesh, HUD.HOVER_COLOR, HUD.HOVER_SCALE_FACTOR);
        }
        this.onUnhover = () => {
            let mesh = this.isPaused ? this.pauseMesh : this.playMesh;
            PauseButton.changeMeshAppearance(mesh, material, 1);
        }
    }

    public getHitbox(): Mesh {
        return this.playMesh;
    }

    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}