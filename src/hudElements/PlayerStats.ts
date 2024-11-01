import {Mesh, Scene, Vector2} from "three";
import {DrawUtils} from "../DrawUtils";
import {HUD} from "../HUD";

export class PlayerStats {
    private static readonly INITIAL_POWER: number = 100;
    private static readonly POWER_IMG: string = "res/power.png";
    private powerImg: Mesh;
    private valueMesh: Mesh;
    private bgMesh: Mesh;
    private power: number;
    private dirtyMesh = false; // Used to determine if the mesh needs to be updated.

    constructor(private readonly scene: Scene, private position: Vector2) {
        this.power = PlayerStats.INITIAL_POWER;
        this.initializeGraphics().then(); // Nothing to do with the promise, just to suppress the warning.
    }

    /**
     * Initializes the graphics for the player stats.
     */
    public async initializeGraphics(): Promise<void> {
        this.powerImg = await DrawUtils.buildImageMesh(PlayerStats.POWER_IMG, 0.1, 0.1);
        this.valueMesh = DrawUtils.buildTextMesh(this.power.toString(), this.position.x, this.position.y, HUD.TEXT_SIZE, HUD.BASE_COLOR, false);
        this.valueMesh.geometry.computeBoundingBox();
        if (this.valueMesh.geometry.boundingBox === null)
            throw new Error("Bounding box is null");
        this.powerImg.position.set(this.valueMesh.position.x + this.valueMesh.geometry.boundingBox.max.x - this.valueMesh.geometry.boundingBox.min.x + 0.05,
            this.valueMesh.position.y + (this.valueMesh.geometry.boundingBox.max.y - this.valueMesh.geometry.boundingBox.min.y) /2,
            0);
        this.bgMesh = DrawUtils.addBackgroundMesh(this.valueMesh, new Vector2(this.valueMesh.position.x + 0.04, this.valueMesh.position.y), HUD.MENU_COLOR, 0.1);
        this.scene.add(this.powerImg, this.valueMesh, this.bgMesh);
    }

    /**
     * Updates the player stats.
     */
    public update(): void {
        if (this.dirtyMesh) {
            DrawUtils.updateText(this.valueMesh, this.power.toString(), false);
            this.dirtyMesh = false;
        }
    }

    /**
     * Gets the power of the player.
     */
    public getPower(): number {
        return this.power;
    }

    /**
     * Used to clean up the player stats.
     */
    public destroy(): void {
        this.scene.remove(this.powerImg, this.valueMesh, this.bgMesh);
        DrawUtils.disposeMeshes(this.powerImg, this.valueMesh, this.bgMesh);
    }
}
