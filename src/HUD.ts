import {MeshBasicMaterial, OrthographicCamera, Scene, Vector2} from "three";
import {DrawUtils} from "./DrawUtils";
import {App} from "./app";
import {ComputerChip} from "./actors/ComputerChip";
import {PauseButton} from "./hudElements/PauseButton";
import {AbstractButton} from "./hudElements/AbstractButton";
import {HUDEventHandler} from "./hudElements/HUDEventHandler";
import {HUDProcessorStats} from "./hudElements/HUDProcessorStats";
import {ComputerChipMenu} from "./hudElements/ComputerChipMenu";

/**
 * Heads-Up Display (HUD) for showing game information.
 */
export class HUD {
    /** The base color for HUD elements. */
    static readonly BASE_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")});

    /** The color for highlighted HUD elements. */
    static readonly HOVER_COLOR: MeshBasicMaterial =
        new MeshBasicMaterial({color: DrawUtils.COLOR_PALETTE.get("LIGHT")});
    /** The factor to scale the button by when hovering. */
    static readonly HOVER_SCALE_FACTOR: number = 1.1;

    /** The size of text in the HUD. */
    static readonly TEXT_SIZE: number = 0.05;

    /** The factor to zoom in or out by. */
    static readonly ZOOM_FACTOR: number = 0.0001;
    /** The maximum zoom level. */
    static readonly MAX_ZOOM: number = 0.2;
    /** The minimum zoom level. */
    static readonly MIN_ZOOM: number = 1;
    /** The maximum camera position on the x-axis. */
    static readonly MAX_CAMERA_POSITION_X = 4;
    /** The maximum camera position on the y-axis. */
    static readonly MAX_CAMERA_POSITION_Y = 4;
    /** The speed at which the camera scrolls. */
    static SCROLL_SPEED: number = 2;

    /** The Stats of the cpu executions at the top left */
    private HUDProcessorStats: HUDProcessorStats;

    /** The menu element that shows up when clicking on a chip */
    private menu: ComputerChipMenu;

    /** The HUD scene and camera. */
    private hudScene: Scene;
    private hudCamera: OrthographicCamera;

    /** All the buttons in the HUD, used for mouse event handling. */
    private readonly buttons: AbstractButton[] = [];

    /** The currently selected and highlighted actor. */
    private selectedActor: ComputerChip;

    /**
     * Initializes the HUD.
     *
     * @param app The application to display the HUD for.
     */
    constructor(private readonly app: App) {
        this.initializeHUDScene();
        new HUDEventHandler(this, this.app, this.hudCamera, this.buttons);
    }

    /**
     * Returns the HUD scene.
     */
    public getHUDScene(): Scene {
        return this.hudScene;
    }

    /**
     * Returns the HUD camera.
     */
    public getHUDCamera(): OrthographicCamera {
        return this.hudCamera;
    }

    /**
     * Updates the HUD.
     */
    public update(): void {
        this.HUDProcessorStats.update();
    }

    /**
     * Selects an actor.
     *
     * @param actor The actor to select.
     */
    public selectActor(actor: ComputerChip): void {
        this.selectedActor = this.selectedActor?.deselect();
        this.selectedActor = actor.select()
        this.showMenu();
    }

    /**
     * Toggles the pause state of the game.
     *
     * @private
     */
    public togglePauseState(): void {
        this.app.paused = !this.app.paused;
    }

    /**
     * Initializes the HUD.
     */
    private initializeHUDScene(): HUD {
        this.hudScene = new Scene();
        this.initializeCamera();
        this.HUDProcessorStats = new HUDProcessorStats(this.hudScene, this.statsPosition(), this.app.cpus);
        this.menu = new ComputerChipMenu(this.hudScene, this.hudCamera, () => this.hideMenu());
        this.buttons.push(
            new PauseButton(this.hudScene, this.pauseButtonPosition(), HUD.BASE_COLOR,
                () => this.togglePauseState()),
            ...this.menu.getButtons()
        );
        return this;
    }

    /**
     * Initializes the HUD camera.
     */
    private initializeCamera(): void {
        const aspect = window.innerWidth / window.innerHeight;
        this.hudCamera = new OrthographicCamera(-aspect, aspect, 1, -1, 1, 3);
        this.hudCamera.position.set(0, 0, 2);
    }

    /**
     * Shows the menu for the selected actor.
     *
     * @private
     */
    private showMenu(): void {
        this.menu.showMenu(this.selectedActor ? this.selectedActor.displayName() : "undefined");
    }

    /**
     * Hides the menu.
     *
     * @private
     */
    private hideMenu(): void {
        this.menu.hideMenu();
        this.selectedActor = this.selectedActor?.deselect();
    }

    /**
     * Computes the position of the selected actor menu.
     */
    private menuPosition(): Vector2 {
        return new Vector2(this.hudCamera.position.x, this.hudCamera.position.y - this.hudCamera.top * 0.8);
    }

    /**
     * Computes the position of the stats text.
     */
    private statsPosition(): Vector2 {
        return new Vector2(this.hudCamera.left + 0.1, this.hudCamera.top - 0.3);
    }

    /**
     *  Computes the position of the pause button.
     */
    private pauseButtonPosition(): Vector2 {
        return new Vector2(this.hudCamera.right - 0.1, this.hudCamera.top - 0.1);
    }
}