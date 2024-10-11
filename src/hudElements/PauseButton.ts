import {AbstractButton} from "./AbstractButton";
import {Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import {HUD} from "../HUD";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils";

/**
 * Button to pause and play the game.
 */
export class PauseButton extends AbstractButton {
    private readonly runMesh: Mesh;
    private readonly pauseMesh: Mesh;
    private readonly hitbox: Mesh;
    private isPaused: boolean = true;

    /**
     * Creates a new pause button.
     *
     * @param scene The scene to add the button to.
     * @param position The position of the button.
     * @param material The material of the button.
     * @param paused The initial pause state.
     * @param togglePause The function to toggle the pause state.
     */
    constructor(scene: Scene, position: Vector2, material: MeshBasicMaterial, paused: boolean, togglePause: () => void) {
        super(scene);
        this.hitbox = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, material, position);
        this.hitbox.visible = false;

        this.runMesh = DrawUtils.buildTriangleMesh(0.1, material)
                                  .translateX(position.x).translateY(position.y)
                                  .rotateZ(-Math.PI / 2);

        let rectGeometry= new PlaneGeometry(0.03, 0.1);
        let pauseGeometry =  mergeGeometries([
            rectGeometry.clone().translate(0.025, 0, 0),
            rectGeometry.clone().translate(-0.025, 0, 0)
        ]);

        this.pauseMesh = new Mesh(pauseGeometry, material);
        this.pauseMesh.position.set(position.x, position.y, 0);

        if (!paused) {
            this.runMesh.visible = false;
            this.pauseMesh.visible = true;
        } else {
            this.runMesh.visible = true;
            this.pauseMesh.visible = false;
        }

        this.scene.add(this.runMesh, this.pauseMesh, this.hitbox);

        this.onClick = () => {
            this.isPaused = !this.isPaused;
            this.runMesh.visible = !this.isPaused;
            this.pauseMesh.visible = this.isPaused;
            togglePause();
        }

        this.onHover = () => {
            let mesh = this.isPaused ? this.pauseMesh : this.runMesh;
            PauseButton.changeMeshAppearance(mesh, HUD.HOVER_COLOR, HUD.HOVER_SCALE_FACTOR);
        }
        this.onUnhover = () => {
            let mesh = this.isPaused ? this.pauseMesh : this.runMesh;
            PauseButton.changeMeshAppearance(mesh, material, 1);
        }
    }

    public getHitbox(): Mesh {
        return this.hitbox;
    }

    private static changeMeshAppearance(mesh: Mesh, color: MeshBasicMaterial, scale?: number): void {
        mesh.material = color;
        if (scale) mesh.scale.set(scale, scale, scale);
    }
}