import {DrawUtils} from "../DrawUtils";
import {Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector2} from "three";
import {TextButton} from "./TextButton";
import {HUD} from "../HUD";
import {ComputerChip} from "../actors/ComputerChip";
import {ChipMenuOptions} from "../dataStructures/ChipMenuOptions";
import {UpgradeOption, UpgradeOptionType} from "../dataStructures/UpgradeOption";

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
    private chipMenuMeshes: Mesh[] = [];
    private chipMenuButtons: TextButton[] = [];

    private rightmostStatX: number = 0;

    /**
     * Initializes the ComputerChipMenu.
     *
     * @param scene The scene to add the menu to.
     * @param hudCamera The camera to display the menu on.
     * @param onClose The function to call when the menu is closed.
     */
    constructor(private scene: Scene, private hudCamera: OrthographicCamera, onClose: () => void) {
        let closeX = this.hudCamera.right - 0.2;
        let closeY = this.hudCamera.bottom + 0.5;
        this.menuMesh = DrawUtils.buildQuadrilateralMesh(hudCamera.right * 2, hudCamera.top * 0.8, ComputerChipMenu.MENU_COLOR,
            new Vector2(this.hudCamera.position.x, this.hudCamera.position.y - this.hudCamera.top * 0.8)
        );
        this.menuMesh.visible = false;

        this.title = DrawUtils.buildTextMesh("undefined", this.hudCamera.left + 0.1, closeY, HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);
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
     * Returns the menu buttons in this menu, so they can be taken care of by the event handler.
     */
    public getMenuButtons(): TextButton[] {
        return this.chipMenuButtons;
    }

    /**
     * Returns the background mesh of the menu.
     */
    public backgroundMeshHitbox(): Mesh {
        return this.menuMesh;
    }

    /**
     * Used to show the menu.
     *
     * @param chip The chip to display information about.
     */
    public showMenu(chip: ComputerChip): void {
        DrawUtils.updateText(this.title, chip ? chip.displayName() : "undefined", false);
        this.title.position.x = this.hudCamera.left + 0.1;
        this.menuMesh.visible = true;
        this.title.visible = true;
        this.closeButton.mesh.visible = true;
        this.renderChipMenu(chip.getMenuOptions());
    }

    /**
     * Used to hide the menu.
     */
    public hideMenu(): void {
        this.menuMesh.visible = false;
        this.title.visible = false;
        this.closeButton.mesh.visible = false;
        this.clearMenu();
        this.rightmostStatX = 0;
    }

    private renderChipMenu(chipMenu: ChipMenuOptions): void {
        this.renderStats(chipMenu);
        chipMenu.upgradeOptions.forEach(
            (option, index) => this.renderUpgradeOption(option, index, chipMenu.upgradeOptions.length)
        );
    }

    private clearMenu(): void {
        this.chipMenuMeshes.forEach(mesh => this.scene.remove(mesh));
        this.chipMenuMeshes = [];
        this.chipMenuButtons.forEach(button => button.dispose());
        this.chipMenuButtons = [];
    }

    private renderUpgradeOption(option: UpgradeOption, index: number, optionCount: number): void {
        const [x, y] = this.renderOptionTitle(option, index, optionCount); // Returns the x and y position of the title
        this.renderDescription(option.description, x, y);

        switch (option.type) {
            case UpgradeOptionType.NumberSelection:
                this.renderNumberSelection(option, x, y);
                break;
            case UpgradeOptionType.SingleValueSelection:
                this.renderSingleValueSelection(option, x, y);
                break;
            default:
                throw new Error(`Unknown upgrade option type: ${option.type}`);
        }
    }

    private renderStats(chipMenu: ChipMenuOptions): void {
        chipMenu.stats.forEach((stat, index) => {
            const text = `${stat.name}: ${stat.value ? stat.value : ""}${stat.unit ? stat.unit : ""}`;
            const y = this.title.position.y - 0.05 - (index + 1) * 0.06;
            const x = this.hudCamera.left + 0.1;
            const mesh = DrawUtils.buildTextMesh(text, x, y, HUD.TEXT_SIZE / 2, HUD.HOVER_COLOR, false);
            mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox === null) {
                throw new Error("Bounding box is null");
            }
            const maxX = mesh.geometry.boundingBox.max.x;
            if (maxX > this.rightmostStatX) {
                this.rightmostStatX = maxX;
            }
            const minX = mesh.geometry.boundingBox.min.x;
            if (stat.button) {
                const button = stat.button
                                   .withScene(this.scene)
                                   .withPosition(new Vector2(x + maxX - minX + 0.05, y))
                                   .withTextSize(HUD.TEXT_SIZE / 2)
                                   .withCentered(false)
                                   .build();
                this.chipMenuButtons.push(button);
                button.mesh.geometry.computeBoundingBox();
                if (button.mesh.geometry.boundingBox === null) {
                    throw new Error("Bounding box is null");
                }
                const buttonMaxX = button.mesh.geometry.boundingBox.max.x;
                if (buttonMaxX > this.rightmostStatX) {
                    this.rightmostStatX = buttonMaxX;
                }
            }
            this.scene.add(mesh);
            this.chipMenuMeshes.push(mesh);
        });
    }

    private renderOptionTitle(option: UpgradeOption, index: number, optionCount: number): [number, number] {
        const text = option.name;
        const canvasWidth = this.hudCamera.right - this.hudCamera.left - this.rightmostStatX;
        const y = this.hudCamera.bottom + 0.40;

        let x: number = this.rightmostStatX + 0.1;
        if (optionCount === 1) {
            x += this.hudCamera.left + canvasWidth / 2; // Center if only one option
        } else {
            const spacing = canvasWidth * 0.4 / (optionCount - 1);
            x += this.hudCamera.left + canvasWidth * 0.3 + index * spacing;
        }

        const mesh = DrawUtils.buildTextMesh(text, x, y, HUD.TEXT_SIZE / 2, HUD.HOVER_COLOR, false);
        mesh.geometry.center();
        this.scene.add(mesh);
        this.chipMenuMeshes.push(mesh);

        return [x, y];
    }

    private renderDescription(description: string, x: number, y: number): void {
        // Split the description into multiple lines if it is too long, only split at spaces.
        const maxLineLength = 20;
        let lines: string[] = [];
        for (let i = 0; i < description.length; i += maxLineLength) {
            let line = description.substring(i, i + maxLineLength);
            if (line.length === maxLineLength) {
                let lastSpace = line.lastIndexOf(" ");
                line = line.substring(0, lastSpace);
                i -= (maxLineLength - lastSpace);
            }
            lines.push(line);
        }

        lines.forEach((line, i) => {
            const y_line = y - 0.15 - (i + 1) * 0.035;
            const mesh = DrawUtils.buildTextMesh(line, x, y_line, HUD.TEXT_SIZE / 2, HUD.HOVER_COLOR, false);
            mesh.geometry.center();
            this.scene.add(mesh);
            this.chipMenuMeshes.push(mesh);
        });
    }

    private renderNumberSelection(option: UpgradeOption, x: number, y: number): void {
        const valueMesh = DrawUtils.buildTextMesh(option.currentValue.toString(), x, y - 0.1, HUD.TEXT_SIZE, HUD.HOVER_COLOR, false);
        valueMesh.geometry.center();
        this.scene.add(valueMesh);
        this.chipMenuMeshes.push(valueMesh);
        const plusButton = new TextButton(this.scene, "[+]", new Vector2(x + 0.1, y - 0.1),
            () => {
                option.currentValue = option.onIncrease();
                DrawUtils.updateText(valueMesh, option.currentValue.toString(), true)
            });
        const minusButton = new TextButton(this.scene, "[-]", new Vector2(x - 0.1, y - 0.1),
            () => {
                option.currentValue = option.onDecrease();
                DrawUtils.updateText(valueMesh, option.currentValue.toString(), true)
            });
        this.chipMenuButtons.push(plusButton, minusButton);
    }

    private renderSingleValueSelection(option: UpgradeOption, x: number, y: number): void {
        return; // TODO: Implement this
    }

    /**
     * Destroys the ComputerChipMenu.
     */
    public destroy() {
        this.scene.remove(this.menuMesh, this.title);
        this.closeButton.dispose();
        this.buttons.forEach(button => button.dispose());
        this.chipMenuButtons.forEach(button => button.dispose());
        this.chipMenuMeshes.forEach(mesh => this.scene.remove(mesh));
        DrawUtils.disposeMeshes(this.menuMesh, this.title, ...this.chipMenuMeshes);
    }
}
