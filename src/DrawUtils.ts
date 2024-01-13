import {
    BufferAttribute,
    BufferGeometry,
    Color,
    GridHelper,
    Material,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Scene,
    TextureLoader
} from "three";
import {Font, FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";

/**
 * This class contains utility functions for drawing 3D objects.
 * It is a static class, so it cannot be instantiated.
 *
 * @class DrawUtils
 * @static
 *
 */
export class DrawUtils {
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARKEST", "#0F0D1B"],
        ["DARKER", "#1F1B2C"],
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#dee7e8"],
        ["GOLDEN_YELLOW", "rgb(255,197,105)"],
        ["LIGHT_GREEN", "rgb(39,203,114)"],
        ["LIGHT_RED", "rgb(217,82,82)"],
    ]);

    private static readonly textureLoader = new TextureLoader();
    private static readonly FONT_DIR: string = "res/Courier_New_Bold.json";
    public static font: Font = null;

    public static baseTextHeight: number;
    public static baseTextWidth: number;

    /**
     * Loads the program font asynchronously. This function must be called before using any other function in this
     * class. It also calculates the base text height and width for the font, which is used to center text all around
     * the application.
     *
     * @returns a promise that resolves when the font is loaded
     * @throws an error if the font is already loaded
     */
    public static loadFont(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.font != null) {
                resolve();
                return;
            }

            new FontLoader().load(this.FONT_DIR, (font: Font) => {
                this.font = font;
                const mesh = this.buildTextMesh("M", 0, 0, 0.1,  // Use a dummy text to calculate the base text height and width
                    // M is usually the widest character in the font, although it does not matter in this case due to
                    // the monospace font
                    new MeshBasicMaterial({color: this.COLOR_PALETTE.get("LIGHT")}));
                this.baseTextHeight = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
                this.baseTextWidth = mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;
                resolve();
            }, undefined, (error) => {
                reject(error);
            });
        });
    }

    /**
     * Generates a quadrilateral mesh with the specified dimensions and color.
     *
     * @param width the width of the quadrilateral
     * @param height the height of the quadrilateral
     * @param color the color of the quadrilateral
     *
     * @returns a quadrilateral mesh
     */
    public static buildQuadrilateralMesh(width: number = 1, height: number = 1, color: Material): Mesh {
        return new Mesh(new PlaneGeometry(width, height), color);
    }

    /**
     * Generates a text mesh with the specified text, size and color.
     * @param text the text to be displayed
     * @param xOffset the x offset of the text
     * @param yOffset the y offset of the text
     * @param size the size of the text
     * @param color the color of the text
     *
     * @returns a text mesh
     */
    public static buildTextMesh(text: string, xOffset: number, yOffset: number, size: number, color: Material, centered: boolean = true): Mesh {
        if (!this.font)
            throw new Error("Font not loaded");

        const textGeometry = new TextGeometry(text, {
            font: this.font,
            size: size,
            height: 0.1
        });

        const textMesh = new Mesh(textGeometry, color);
        if (centered) {
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
            textMesh.position.set(
                xOffset - textWidth / 2, // Center the text
                yOffset - textHeight / 2, // use top of text as the origin
                0
            );
        }

        return textMesh;
    }

    public static updateText(mesh: Mesh, text: string, centered?: boolean): void {
        mesh.geometry.dispose();
        const textGeometry = new TextGeometry(text, {
            font: DrawUtils.font,
            size: mesh.geometry instanceof TextGeometry ? mesh.geometry.parameters.options.size : 0.1,
            height: 0.1,
        });

        mesh.geometry = textGeometry;
        if (centered)
            mesh.geometry.center();
    }

    public static drawGrid(scene: Scene): void {
        const gridColor = DrawUtils.COLOR_PALETTE.get("DARKER");
        const size = 100; // A large size to simulate infinity
        const divisions = 1000; // Number of divisions in the grid
        const gridHelper = new GridHelper(size, divisions, gridColor, gridColor);
        gridHelper.rotateX(Math.PI / 2);
        gridHelper.material.depthWrite = false;
        gridHelper.position.set(0, 0, -0.01);
        scene.add(gridHelper);
    }

    public static buildTriangleMesh(side: number, color: Color | Material): Mesh {
        const height = Math.sqrt(3) / 2 * side; // Calculate height of an equilateral triangle

        const geometry = new BufferGeometry();
        const vertices = new Float32Array([
            -side / 2, -height / 2, 0.0,  // Vertex 1 (X, Y, Z)
            side / 2, -height / 2, 0.0,   // Vertex 2 (X, Y, Z)
            0.0, height / 2, 0.0          // Vertex 3 (X, Y, Z)
        ]);
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));

        const material = color instanceof Material ? color : new MeshBasicMaterial({color: color});
        return new Mesh(geometry, material);
    }

    public static buildImageMesh(image: string, width: number, height: number): Mesh {
        let material: Material;
        const geometry = new PlaneGeometry(width, height);
        DrawUtils.textureLoader.load(image, function (texture) {
            material = new MeshBasicMaterial({map: texture});
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.set(0, 0, 0); // Replace 0, 0, 0 with your desired position
        return mesh;
    }


    /**
     * Converts a number to a hexadecimal string for display
     *
     * @param value the number to convert
     * @protected
     */
    public static toHex(value: number): string {
        return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    }

    public static formatFrequency(frequency: number): string {
        return frequency < 1000 ? `${frequency} Hz` : `${(frequency / 1000).toFixed(2)} KHz`;
    }
}


