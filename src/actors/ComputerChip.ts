import {Color, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {Instruction} from "../components/Instruction";
import {Font} from "three/examples/jsm/loaders/FontLoader";

export abstract class ComputerChip {
    public readonly id: string;
    protected readonly position: { x: number; y: number };
    protected readonly scene: Scene;

    protected static readonly COLORS: Map<string, string> = new Map([
        ["BODY", DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")],
        ["COMPONENT", DrawUtils.COLOR_PALETTE.get("LIGHT")],
        ["TEXT", DrawUtils.COLOR_PALETTE.get("DARK")]
    ]);

    // used to store the dimensions and positions of the graphic elements that make up the CPU
    protected readonly graphicComponentProperties: Map<string, {
        width: number,
        height: number,
        xOffset: number,
        yOffset: number,
        color: string
    }>;

    protected readonly graphicComponents: Map<string, Mesh>;
    protected static readonly TEXT_SIZE: number = 0.05;
    protected readonly textComponents: Map<string, Mesh>;

    protected constructor(id: string, position: [number, number], scene: Scene) {
        DrawUtils.onFontLoaded(() => {
            this.draw();
        });
        this.id = id;
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.graphicComponents = new Map<string, Mesh>();
        this.graphicComponentProperties = new Map<string, {
            width: number,
            height: number,
            xOffset: number,
            yOffset: number,
            color: string
        }>();
        this.textComponents = new Map<string, Mesh>();
    }

    abstract draw(): void;

    abstract update(): void;

    protected drawSimpleGraphicComponent(name: string): void {
        const graphicComponent = this.graphicComponentProperties.get(name);
        const component = DrawUtils.drawQuadrilateral(
            graphicComponent.width, graphicComponent.height, graphicComponent.color);
        component.position.set(this.position.x + graphicComponent.xOffset, this.position.y + graphicComponent.yOffset, 0);
        this.graphicComponents.set(name, component);
    }

    protected drawTextForComponent(componentName: string, component_buffer: Instruction[], yOffsetIncrement: number): void {
        for (let i = 0; i < component_buffer.length; ++i) {
            const instruction = component_buffer[i];
            if (instruction)
                this.textComponents.set(`${componentName}_TEXT_${i}`,
                    DrawUtils.drawText(
                        instruction.toString(),
                        this.graphicComponentProperties.get(componentName).xOffset,
                        this.graphicComponentProperties.get(componentName).yOffset // center of the component
                        + (this.graphicComponentProperties.get(componentName).height / 2) // on top of the component
                        - (i * yOffsetIncrement),
                        ComputerChip.TEXT_SIZE,
                        ComputerChip.COLORS.get("TEXT")
                    )
                );
        }
    }

    protected changeComponentColor(componentName: string, newColor: string | number | Color): void {
        const component = this.graphicComponents.get(componentName);
        if (component && component.material instanceof MeshBasicMaterial) {
            component.material.color.set(newColor);
            component.material.needsUpdate = true; // This line might be necessary to tell Three.js to update the material
        } else {
            console.warn('Component not found or has incompatible material');
        }
    }

    protected getFixedArrayLength<T>(array: Array<T>): number {
        return array.filter(item => item != null).length;
    }
}
