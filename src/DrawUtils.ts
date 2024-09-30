import {
    BufferAttribute,
    BufferGeometry,
    Color,
    GridHelper,
    Line,
    LineBasicMaterial,
    Material,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Scene, Texture,
    TextureLoader,
    Vector2, Vector3
} from "three";
import {Font, FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";

/**
 * A utility class providing static methods for creating various 3D objects and text for the application.
 * This class cannot be instantiated and all methods are meant to be accessed directly via the class name.
 */
export class DrawUtils {
    /** A predefined set of colors used throughout the application. */
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARKEST", "#0F0D1B"],
        ["DARKER", "#1F1B2C"],
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#dee7e8"],
        ["GOLDEN_YELLOW", "#FFC569"],
        ["LIGHT_GREEN", "#27CB72"],
        ["LIGHT_RED", "#D95252"],
        ["LIGHT_BLUE", "#3CB2FC"]
    ]);

    /** Used for loading textures from images. */
    private static readonly textureLoader = new TextureLoader();

    /** The directory path to the font used in the application. */
    private static readonly FONT_DIR: string = "res/Courier_New_Bold.json";

    /** The font object loaded and used for rendering text. */
    public static font: Font = null;

    /** The base height of the text, calculated after the font is loaded. */
    public static baseTextHeight: number;

    /** The base width of the text, calculated after the font is loaded. */
    public static baseTextWidth: number;

    /**
     * Asynchronously loads the font used for text in the application.
     * This method should be called before any text rendering functions.
     *
     * @returns {Promise<void>} A promise that resolves when the font is loaded.
     */
    public static loadFont(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.font) {
                resolve();
                return;
            }

            new FontLoader().load(this.FONT_DIR, (font: Font) => {
                this.font = font;
                // Calculate base text height and width using a sample character.
                const mesh = this.buildTextMesh("M", 0, 0, 0.1, new MeshBasicMaterial({color: this.COLOR_PALETTE.get("LIGHT")}));
                mesh.geometry.computeBoundingBox();
                this.baseTextHeight = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
                this.baseTextWidth = mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;
                resolve();
            }, undefined, reject);
        });
    }

    /**
     * Creates a quadrilateral mesh with specified dimensions and material.
     *
     * @param {number} width - The width of the quadrilateral.
     * @param {number} height - The height of the quadrilateral.
     * @param {Material} material - The material to apply to the quadrilateral.
     * @param {Vector2} position - The position of the quadrilateral in the scene.
     * @returns {Mesh} The created quadrilateral mesh.
     */
    public static buildQuadrilateralMesh(width: number = 1, height: number = 1, material: Material, position: Vector2): Mesh {
        const geometry = new PlaneGeometry(width, height);
        const mesh = new Mesh(geometry, material);
        mesh.position.set(position.x, position.y, 0);
        return mesh;
    }

    /**
     * Creates a text mesh with the specified parameters.
     *
     * @param {string} text - The text to display.
     * @param {number} xOffset - The x offset from the origin.
     * @param {number} yOffset - The y offset from the origin.
     * @param {number} size - The size of the text.
     * @param {Material} material - The material to apply to the text.
     * @param {boolean} [centered=true] - Whether to center the text around its position.
     * @param {number} [zRotation=0] - The rotation around the z-axis, in radians.
     * @returns {Mesh} The created text mesh.
     */
    public static buildTextMesh(text: string, xOffset: number, yOffset: number, size: number, material: Material, centered: boolean = true, zRotation: number = 0): Mesh {
        if (!this.font) throw new Error("Font not loaded");

        const geometry = new TextGeometry(text, {
            font: this.font,
            size: size,
            height: 0.05,
        });

        const mesh = new Mesh(geometry, material);
        geometry.computeBoundingBox();
        const textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        const textHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

        mesh.position.set(
            xOffset - (centered ? textWidth / 2 : 0),
            yOffset - (centered ? textHeight / 2 : 0),
            0
        );

        if (zRotation !== 0) {
            mesh.geometry.center().rotateZ(zRotation);
            mesh.position.set(xOffset, yOffset, 0);
        }

        return mesh;
    }

    /**
     * Updates the text of a given mesh with new content.
     *
     * @param {Mesh} mesh - The mesh whose text needs to be updated.
     * @param {string} text - The new text content.
     * @param {boolean} [centered=true] - Specifies whether the text should be centered.
     */
    public static updateText(mesh: Mesh, text: string, centered: boolean = true): void {
        mesh.geometry.dispose();  // Dispose of the current geometry to prevent memory leaks.
        mesh.geometry = new TextGeometry(text, {
            font: DrawUtils.font,
            size: mesh.geometry instanceof TextGeometry ? mesh.geometry.parameters.options.size : 0.1,
            height: 0.1,
        });
        if (centered)
            mesh.geometry.center();
    }

    /**
     * Draws a grid helper in the given scene, useful for visualizing the ground plane.
     *
     * @param {Scene} scene - The scene where the grid should be added.
     */
    public static drawGrid(scene: Scene): void {
        const gridColor = DrawUtils.COLOR_PALETTE.get("DARKER");
        const size = 100;  // A large size to simulate an infinite ground plane.
        const divisions = 1000;  // Dense divisions to give a detailed grid.
        const gridHelper = new GridHelper(size, divisions, gridColor, gridColor);
        gridHelper.rotateX(Math.PI / 2);  // Rotate to lay flat on the ground.
        gridHelper.material.depthWrite = false;  // Prevent grid lines from interfering with depth calculations.
        gridHelper.position.set(0, 0, -0.2);  // Slightly below y=0 to avoid z-fighting with other ground elements.
        scene.add(gridHelper);
    }

    /**
     * Creates a triangle mesh based on the given side length and color/material.
     *
     * @param {number} side - The length of each side of the equilateral triangle.
     * @param {Color | Material} color - The color or material to apply to the triangle.
     * @returns {Mesh} The created triangle mesh.
     */
    public static buildTriangleMesh(side: number, color: Color | Material): Mesh {
        const height = Math.sqrt(3) / 2 * side;  // Calculate height of an equilateral triangle.
        const geometry = new BufferGeometry();  // Use BufferGeometry for efficient memory usage.
        const vertices = new Float32Array([
            -side / 2, -height / 2, 0,  // Vertex 1
            side / 2, -height / 2, 0,   // Vertex 2
            0, height / 2, 0            // Vertex 3
        ]);
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));  // Define the position attribute.

        const material = color instanceof Material ? color : new MeshBasicMaterial({color: color});
        return new Mesh(geometry, material);  // Create and return the mesh.
    }

    /**
     * Loads an image texture and applies it to a mesh of the specified dimensions.
     *
     * @param {string} image - The URL of the image texture.
     * @param {number} width - The width of the resulting mesh.
     * @param {number} height - The height of the resulting mesh.
     * @returns {Promise<Mesh>} - A promise that resolves with the created mesh.
     */
    public static async buildImageMesh(image: string, width: number, height: number): Promise<Mesh> {
        const geometry = new PlaneGeometry(width, height);  // Create a plane geometry with the given dimensions.

        // Wrap the texture loading in a Promise
        const texture = await new Promise<Texture>((resolve, reject) => {
            DrawUtils.textureLoader.load(image, resolve, undefined, reject);
        });

        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,  // Allow for PNG transparency.
        });

        return new Mesh(geometry, material);
    }

    /**
     * Adds a background mesh to a given mesh with a specified material.
     *
     * @param {Mesh} mesh - The mesh to add a background to.
     * @param {Vector2} position - The position of the mesh.
     * @param {MeshBasicMaterial} material - The material to use for the background.
     * @param padding - The padding to add around the mesh.
     * @returns {Mesh} The created background mesh.
     */
    public static addBackgroundMesh(mesh: Mesh, position: Vector2, material: MeshBasicMaterial, padding: number = 0.05): Mesh {
        mesh.geometry.computeBoundingBox();
        const background = DrawUtils.buildQuadrilateralMesh(mesh.geometry.boundingBox.getSize(new Vector3()).x + padding,
            mesh.geometry.boundingBox.getSize(new Vector3()).y + 0.03, material,
            new Vector2(position.x + mesh.geometry.boundingBox.getSize(new Vector3()).x / 2,
                position.y + mesh.geometry.boundingBox.getSize(new Vector3()).y / 2));
        background.position.x = position.x + mesh.geometry.boundingBox.getSize(new Vector3()).x / 2;
        background.position.y = position.y + mesh.geometry.boundingBox.getSize(new Vector3()).y / 2;
        return background;
    }

    /**
     * Creates a line mesh between two points with the specified color.
     *
     * @param {Vector2} v1 - The start point of the line.
     * @param {Vector2} v2 - The end point of the line.
     * @param {Color} color - The color of the line.
     * @returns {Line} The created line mesh.
     */
    public static buildLineMesh(v1: Vector2, v2: Vector2, color: Color): Line {
        const geometry = new BufferGeometry();  // Use BufferGeometry for efficient memory usage.
        const vertices = new Float32Array([
            v1.x, v1.y, 0,
            v2.x, v2.y, 0
        ]);
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));  // Define the position attribute.

        const material = new LineBasicMaterial({color: color});
        return new Line(geometry, material);  // Create and return the line.
    }

    /**
     * Disposes of the geometry and material of a list of meshes.
     *
     * @param {...Mesh[]} meshes - The meshes to dispose of.
     */
    public static disposeMeshes(...meshes: Mesh[]): void {
        meshes.forEach(mesh => this.disposeMesh(mesh));
    }

    /**
     * Disposes of the geometry and material of a single mesh.
     *
     * @param {Mesh} mesh - The mesh to dispose of.
     */
    public static disposeMesh(mesh: Mesh): void {
        // Dispose geometry
        if (mesh.geometry) {
            mesh.geometry.dispose();
        }

        // Dispose material
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    }

    /**
     * Converts a numeric value to a hexadecimal string representation.
     *
     * @param {number} value - The number to convert to hex.
     * @returns {string} The hexadecimal string representation of the value.
     */
    public static toHex(value: number): string {
        return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    }
}