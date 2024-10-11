import {App} from "../app";
import {OrthographicCamera, Raycaster, Vector2} from "three";
import {AbstractButton} from "./AbstractButton";
import {HUD} from "../HUD";

/**
 * Handles the user interaction events in the Game HUD.
 */
export class HUDEventHandler {
    private raycaster = new Raycaster(); // mouse raycaster
    private mouse = new Vector2(); // mouse coordinates
    private mouseDown = false;
    private initialMousePosition = new Vector2();
    chipMenuButtons: AbstractButton[] = [];

    /**
     * Initializes the HUD event handler.
     *
     * @param hud The HUD to handle events for.
     * @param app The application to handle events for.
     * @param hudCamera The HUD camera.
     * @param buttons The buttons in the HUD.
     */
    constructor(private hud: HUD, private app: App, private hudCamera: OrthographicCamera, private buttons: AbstractButton[]) {
        document.addEventListener('click', this.onMouseClick.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseDrag);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('wheel', this.onMouseWheel);

        // Touch event listeners (similar to mouse)
        document.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        document.addEventListener('touchmove', this.onTouchMove.bind(this), false);
        document.addEventListener('touchend', this.onTouchEnd.bind(this), false);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Updates the mouse coordinates.
     * @param event The mouse event.
     * @private
     */
    private updateMouseCoordinates(event: MouseEvent): void {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Handles the mouse click event.
     *
     * @param event The mouse event.
     * @private
     */
    private onMouseClick(event: MouseEvent): void {
        this.updateMouseCoordinates(event);

        this.raycaster.setFromCamera(this.mouse, this.hudCamera);

        this.chipMenuButtons.forEach(button => {
            if (!button.isClickable()) return;
            if (this.raycaster.intersectObject(button.getHitbox()).length > 0) {
                button.onClick();
                return;
            }
        });

        this.buttons.forEach(button => {
            if (!button.isClickable()) return;
            if (this.raycaster.intersectObject(button.getHitbox()).length > 0) {
                button.onClick();
                return;
            }
        });

        if (this.raycaster.intersectObject(
            this.hud.getComputerChipMenu().backgroundMeshHitbox()).length > 0
        )
            return;

        this.raycaster.setFromCamera(this.mouse, this.app.camera);

        this.app.gameActors.forEach(actor => {
            if (this.raycaster.intersectObject(actor.getHitBoxMesh()).length > 0) {
                this.hud.selectActor(actor);
                return;
            }
        });
    }


    /**
     * Handles the mouse down event.
     * @param event The mouse event.
     */
    private onMouseDown = (event: MouseEvent) => {
        this.mouseDown = true;
        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    /**
     * Handles the mouse up event.
     */
    private onMouseUp = () => {
        this.mouseDown = false;
    }

    /**
     * Handles the mouse wheel event.
     * @param event The mouse wheel event.
     */
    private onMouseWheel = (event: WheelEvent) => {
        this.app.camera.zoom += event.deltaY * -HUD.ZOOM_FACTOR;
        this.app.camera.zoom = Math.max(HUD.MAX_ZOOM, this.app.camera.zoom); // prevent zooming too far in
        this.app.camera.zoom = Math.min(HUD.MIN_ZOOM, this.app.camera.zoom); // prevent zooming too far out
        this.app.camera.updateProjectionMatrix();
    }

    /**
     * Handles the mouse drag event.
     * @param event The mouse drag event.
     */
    private onMouseDrag = (event: MouseEvent): void => {
        if (!this.mouseDown) return;

        const deltaX = (event.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (event.clientY - this.initialMousePosition.y) / window.innerHeight;

        // Move the camera
        this.moveCamera(deltaX, deltaY);

        // Update the initial position
        this.initialMousePosition.set(event.clientX, event.clientY);
    }

    /**
     * Handles the mouse move event.
     *
     * @param event The mouse event.
     * @private
     */
    private onMouseMove(event: MouseEvent): void {
        this.updateMouseCoordinates(event);
        this.checkHoverState();
    }

    /**
     * Checks the hover state of the mouse.
     *
     * @private
     */
    private checkHoverState(): void {
        this.raycaster.setFromCamera(this.mouse, this.hudCamera);
        this.buttons.concat(this.chipMenuButtons).forEach(button => {
            if (button.isHoverable()) {
                const intersected = this.raycaster.intersectObject(button.getHitbox()).length > 0;
                if (intersected) button.onHover();
                else button.onUnhover();
            }
        });
    }

    /**
     * Handles the touch start event for mobile devices.
     *
     * @param event
     * @private
     */
    private onTouchStart(event: TouchEvent): void {
        const touch = event.touches[0];
        this.mouseDown = true;
        this.initialMousePosition.set(touch.clientX, touch.clientY);

        // Call mouse down logic
        this.onMouseDown({clientX: touch.clientX, clientY: touch.clientY} as MouseEvent);
    }

    /**
     * Handles the touch move event for mobile devices.
     *
     * @param event The touch event.
     * @private
     */
    private onTouchMove(event: TouchEvent): void {
        if (!this.mouseDown) return;  // Only process if touch is active (similar to mouseDown)

        const touch = event.touches[0];
        const deltaX = (touch.clientX - this.initialMousePosition.x) / window.innerWidth;
        const deltaY = (touch.clientY - this.initialMousePosition.y) / window.innerHeight;

        // Move the camera
        this.moveCamera(deltaX, deltaY);

        // Update the initial position
        this.initialMousePosition.set(touch.clientX, touch.clientY);

        // Prevent default to avoid scrolling
        event.preventDefault();
    }

    /**
     * Handles the touch end event for mobile devices.
     *
     * @private
     */
    private onTouchEnd(): void {
        this.mouseDown = false;
        this.onMouseUp();
    }


    /**
     * Handles the window resize event.
     *
     * @private
     */
    private onWindowResize(): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        this.app.camera.left = -aspectRatio;
        this.app.camera.right = aspectRatio;
        this.hudCamera.left = -aspectRatio;
        this.hudCamera.right = aspectRatio;

        this.app.camera.updateProjectionMatrix();
        this.hudCamera.updateProjectionMatrix();
        this.app.renderer.setSize(window.innerWidth, window.innerHeight);
        this.hud.reset();
    }

    /**
     * Moves the camera based on the input deltas.
     *
     * @param deltaX The change in X direction.
     * @param deltaY The change in Y direction.
     */
    private moveCamera(deltaX: number, deltaY: number): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        const scaleX = aspectRatio * HUD.SCROLL_SPEED / this.app.camera.zoom;
        const scaleY = HUD.SCROLL_SPEED / this.app.camera.zoom;

        this.app.camera.position.x -= deltaX * scaleX;
        this.app.camera.position.x = Math.max(-HUD.MAX_CAMERA_POSITION_X, this.app.camera.position.x);
        this.app.camera.position.x = Math.min(HUD.MAX_CAMERA_POSITION_X, this.app.camera.position.x);

        this.app.camera.position.y += deltaY * scaleY;
        this.app.camera.position.y = Math.max(-HUD.MAX_CAMERA_POSITION_Y, this.app.camera.position.y);
        this.app.camera.position.y = Math.min(HUD.MAX_CAMERA_POSITION_Y, this.app.camera.position.y);
    }
}