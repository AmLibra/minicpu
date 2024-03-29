import {DrawUtils} from "../DrawUtils";
import {Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector2} from "three";
import {TextButton} from "./TextButton";
import {HUD} from "../HUD";

/**
 * Represents the menu used to display information about a computer chip, as well as the buttons to interact with it.
 */
export class ComputerChipMenu {
    private static readonly MENU_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK")});

    private readonly menuMesh: Mesh;
    private readonly title: Mesh;
    private readonly closeButton: TextButton;
    private buttons: TextButton[] = [];

    /**
     * Initializes the ComputerChipMenu.
     *
     * @param scene The scene to add the menu to.
     * @param hudCamera The camera to display the menu on.
     * @param onClose The function to call when the menu is closed.
     */
    constructor(private scene: Scene, private hudCamera: OrthographicCamera, onClose: () => void) {
        let closeX = this.hudCamera.right - 0.2;
        let closeY = this.hudCamera.bottom + 0.53;
        this.menuMesh = DrawUtils.buildQuadrilateralMesh(hudCamera.right * 2, hudCamera.top * 0.8, ComputerChipMenu.MENU_COLOR,
            new Vector2(this.hudCamera.position.x, this.hudCamera.position.y - this.hudCamera.top * 0.8)
        );
        this.menuMesh.visible = false;

        this.title = DrawUtils.buildTextMesh("undefined", 0, closeY,
            HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);
        this.title.geometry.center();
        this.title.visible = false;

        this.closeButton = new TextButton(this.scene, "[X]", new Vector2(closeX, closeY), () => onClose());
        this.closeButton.mesh.visible = false;

        this.buttons.push(this.closeButton);
        this.scene.add(this.menuMesh, this.title);
    }

    /**
     * Returns the buttons in this menu, so they can be taken care of by the event handler.
     */
    public getButtons(): TextButton[] {
        return this.buttons;
    }

    /**
     * Used to show the menu.
     *
     * @param title The title of the menu, typically the name of the computer chip.
     */
    public showMenu(title: string): void {
        DrawUtils.updateText(this.title, title, true);
        this.menuMesh.visible = true;
        this.title.visible = true;
        this.closeButton.mesh.visible = true;
    }

    /**
     * Used to hide the menu.
     */
    public hideMenu(): void {
        this.menuMesh.visible = false;
        this.title.visible = false;
        this.closeButton.mesh.visible = false;
    }
}
