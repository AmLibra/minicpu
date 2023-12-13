import {Mesh, MeshBasicMaterial, PlaneGeometry} from "three";

export class DrawUtils {
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#FAF0E6"]
    ]);

    public static drawQuadrilateral(width: number = 1, height: number = 1,
                                    color: string = this.COLOR_PALETTE.get("LIGHT")): Mesh {
        return new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({color: color}));
    }
}


