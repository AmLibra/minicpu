import {Mesh, MeshBasicMaterial, PlaneGeometry} from "three";
import {Font, FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";

/**
 * This class contains utility functions for drawing 3D objects.
 * It is a static class, so it cannot be instantiated.
 *
 * @class DrawUtils
 * @static
 */
export class DrawUtils {
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#FAF0E6"]
    ]);

    private static fontLoader: FontLoader = new FontLoader();
    private static FONT: string = "../../res/Courier_New_Bold.json";
    public static font: Font = null;

    /**
     * Used to execute a callback function after the font is loaded.
     * @param callback the callback function
     */
    public static onFontLoaded(callback: Function): void {
        this.awaitFontLoad().then(() => callback());
    }

    /**
     * Generates a quadrilateral mesh with the specified dimensions and color.
     * @param width the width of the quadrilateral
     * @param height the height of the quadrilateral
     * @param color the color of the quadrilateral
     */
    public static buildQuadrilateralMesh(width: number = 1, height: number = 1,
                                         color: string = this.COLOR_PALETTE.get("LIGHT")): Mesh {
        return new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({color: color}));
    }

    /**
     * Generates a text mesh with the specified text, size and color.
     * @param text the text to be displayed
     * @param xOffset the x offset of the text
     * @param yOffset the y offset of the text
     * @param size the size of the text
     * @param color the color of the text
     */
    public static buildTextMesh(text: string, xOffset: number, yOffset: number, size: number, color: string): Mesh {
        if (this.font == null)
            return null;
        const textGeometry = new TextGeometry(text, {
            font: this.font,
            size: size,
            height: 0.1,
            curveSegments: 12,
            bevelEnabled: false
        });

        const textMesh =
            new Mesh(textGeometry,  new MeshBasicMaterial({color: color}));

        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
        textMesh.position.set(
            xOffset - textWidth / 2, // Center the text
            yOffset - textHeight, // use top of text as the origin
            0
        );
        return textMesh;
    }

    /**
     * Used to load the font asynchronously.
     */
    private static async awaitFontLoad(): Promise<void> {
        if (this.font == null)
            await new Promise<void>(resolve => {
                this.fontLoader.load(this.FONT, (font: Font) => {
                    this.font = font;
                    resolve();
                });
            });
    }
}


