import {
    BufferAttribute,
    BufferGeometry,
    GridHelper,
    Material,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Scene
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
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#FAF0E6"]
    ]);

    private static fontLoader: FontLoader = new FontLoader();
    private static FONT: string = "../../res/Courier_New_Bold.json";
    public static font: Font = null;

    public static isFontLoaded: boolean = false;

    public static baseTextHeight: number;
    public static baseTextWidth: number;


    /**
     * Loads the program font asynchronously.
     */
    public static loadFont(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.font != null) {
                resolve();
                return;
            }

            this.fontLoader.load(this.FONT, (font: Font) => {
                this.font = font;
                this.isFontLoaded = true;
                const mesh = this.buildTextMesh("A", 0, 0, 0.1, new MeshBasicMaterial({color: this.COLOR_PALETTE.get("LIGHT")}));
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
    public static buildTextMesh(text: string, xOffset: number, yOffset: number, size: number, color: Material): Mesh {
        if (!this.isFontLoaded)
            throw new Error("Font not loaded");

        const textGeometry = new TextGeometry(text, {
            font: this.font,
            size: size,
            height: 0.1
        });

        const textMesh = new Mesh(textGeometry, color);
        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
        textMesh.position.set(
            xOffset - textWidth / 2, // Center the text
            yOffset - textHeight / 2, // use top of text as the origin
            0
        );
        return textMesh;
    }

    public static drawGrid(scene: Scene): void {
        const gridColor = DrawUtils.COLOR_PALETTE.get("MEDIUM_DARK");
        const size = 100; // A large size to simulate infinity
        const divisions = 1000; // Number of divisions in the grid
        const gridHelper = new GridHelper(size, divisions, gridColor, gridColor);
        gridHelper.rotateX(Math.PI / 2);
        gridHelper.material.depthWrite = false;
        gridHelper.position.set(0, 0, -0.01);
        scene.add(gridHelper);
    }

   public static buildTriangleMesh(side: number, color: THREE.Color | THREE.Material): THREE.Mesh {
    const height = Math.sqrt(3) / 2 * side; // Calculate height of an equilateral triangle

    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
        -side / 2, -height / 2, 0.0,  // Vertex 1 (X, Y, Z)
        side / 2, -height / 2, 0.0,   // Vertex 2 (X, Y, Z)
        0.0, height / 2, 0.0          // Vertex 3 (X, Y, Z)
    ]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));

    // Create a material from the color if it's not already a material
    const material = color instanceof Material ? color : new MeshBasicMaterial({ color: color });

    return new Mesh(geometry, material);
}
}


