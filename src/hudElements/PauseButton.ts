import {Button} from "./Button";
import {Mesh, MeshBasicMaterial, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";

export class PauseButton extends Button {
    private readonly pauseMesh: Mesh;
    private readonly playMesh: Mesh;

    constructor(scene: Scene, position: Vector2, material: MeshBasicMaterial) {
        super(scene);
        this.pauseMesh = DrawUtils.buildTriangleMesh(0.1, material)
            .translateX(position.x).translateY(position.y)
            .rotateZ(-Math.PI / 2);

        this.playMesh = DrawUtils.buildQuadrilateralMesh(0.1, 0.1, material, position);
        this.playMesh.visible = false;

        this.hitbox = this.playMesh;

        this.scene.add(this.pauseMesh, this.playMesh);
    }
}