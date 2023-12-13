import {Mesh, MeshBasicMaterial, PlaneGeometry, Scene} from "three";

export class DrawUtils {
    public static readonly COLOR_PALETTE: Map<string, string> = new Map([
        ["DARK", "#352F44"],
        ["MEDIUM_DARK", "#5C5470"],
        ["MEDIUM_LIGHT", "#B9B4C7"],
        ["LIGHT", "#FAF0E6"]
    ]);

    public static draw_quadrilateral(scene: Scene, x: number = 0, y: number = 0, z: number = 0, width: number = 1,
                               height: number = 1, color: string = this.COLOR_PALETTE.get("LIGHT")): void {

        const geometry = new PlaneGeometry(width, height);
        const material = new MeshBasicMaterial({color: color});
        const square = new Mesh(geometry, material);
        square.position.set(x, y, z);
        scene.add(square);
    }
}


