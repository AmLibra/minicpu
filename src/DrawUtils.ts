import {Mesh, MeshBasicMaterial, PlaneGeometry, Scene} from "three";
import {Font, FontLoader} from "three/examples/jsm/loaders/FontLoader";
import {TextGeometry} from "three/examples/jsm/geometries/TextGeometry";
import {ComputerChip} from "./actors/ComputerChip";

export class DrawUtils {
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#FAF0E6"]
    ]);

    private static fontLoader: FontLoader = new FontLoader();
    private static FONT: string = "../../res/Courier_New_Bold.json";
    public static font: Font | null = null;

    public static drawQuadrilateral(width: number = 1, height: number = 1,
                                    color: string = this.COLOR_PALETTE.get("LIGHT")): Mesh {
        return new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({color: color}));
    }

    public static loadFont(): void {
        this.fontLoader.load(this.FONT, (font) => {
             this.font = font;
        });
    }

    public static drawText(text: string, xOffset: number, yOffset: number, size: number, color: string): Mesh {
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
        ); // Center the text

        return textMesh;
    }
}


