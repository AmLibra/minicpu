import {Color, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {Instruction} from "../components/Instruction";

export abstract class ComputerChip {
    public static readonly ONE_SECOND: number = 1000;

    public readonly id: string;
    protected readonly position: { x: number; y: number };
    protected readonly scene: Scene;

    protected static readonly COLORS: Map<string, string> = new Map([
        ["BODY", DrawUtils.COLOR_PALETTE.get("MEDIUM_LIGHT")],
        ["COMPONENT", DrawUtils.COLOR_PALETTE.get("LIGHT")],
        ["TEXT", DrawUtils.COLOR_PALETTE.get("DARK")]
    ]);
    protected static readonly TEXT_SIZE: number = 0.05;

    // used to store the dimensions and positions of the graphic elements that make up the CPU
    protected graphicComponentProperties: Map<string, {
        width: number,
        height: number,
        xOffset: number,
        yOffset: number,
        color: string
    }>;

    protected readonly graphicComponents: Map<string, Mesh>;
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

    protected drawBuffer(parent: {
                           width: number,
                           height: number,
                           xOffset: number,
                           yOffset: number,
                           color: string
                       },
                         memorySize:number, margin: number, spacing: number, color: string
    ): Map<string, {
        width: number,
        height: number,
        xOffset: number,
        yOffset: number,
        color: string
    }> {
        const bufferNames: Map<string, {
            width: number,
            height: number,
            xOffset: number,
            yOffset: number,
            color: string
        }> = new Map<string, {
            width: number,
            height: number,
            xOffset: number,
            yOffset: number,
            color: string
        }>();

        const innerHeight = parent.height - (2 * margin);
        const totalSpacing = spacing * (memorySize - 1);
        const rectangleHeight = (innerHeight - totalSpacing) / memorySize;
        const startYOffset = margin + rectangleHeight / 2;
        for (let i = 0; i < memorySize; ++i) {
            const bufferName = `BUFFER_${i}`;
            const buffer = {
                width: parent.width - (2 * margin),
                height: rectangleHeight,
                xOffset: 0,
                yOffset: startYOffset + i * (rectangleHeight + spacing) - parent.height / 2,
                color: color
            }
            this.graphicComponentProperties.set(bufferName, buffer);
            bufferNames.set(bufferName, buffer);
        }
        return bufferNames;
    }

    protected drawGrid(parent: {
                           width: number,
                           height: number,
                           xOffset: number,
                           yOffset: number,
                           color: string
                       }, rowCount: number, columnCount: number, margin: number, registerNames?: string[]
    ): Map<string, {
        width: number,
        height: number,
        xOffset: number,
        yOffset: number,
        color: string
    }> {
        if (registerNames && registerNames.length != rowCount * columnCount)
            throw new Error("Number of register names does not match the number of registers");

        // Calculate dimensions for each individual register file, accounting for margins
        const registerWidth =
            (parent.width - margin * (columnCount - 1)) / columnCount;
        const registerHeight =
            (parent.height - margin * (rowCount - 1)) / rowCount;

        const registers: Map<string, {
            width: number,
            height: number,
            xOffset: number,
            yOffset: number,
            color: string
        }> = new Map<string, {
            width: number,
            height: number,
            xOffset: number,
            yOffset: number,
            color: string
        }>();


        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < columnCount; j++) {
                const topLeft = {
                    x: parent.xOffset - parent.width / 2,
                    y: parent.yOffset + parent.height / 2
                }

                const xOffset = topLeft.x + (registerWidth / 2)
                    + (registerWidth + margin) * j;
                const yOffset = topLeft.y - (registerHeight / 2)
                    - (registerHeight + margin) * i;

                const register = {
                    width: registerWidth,
                    height: registerHeight,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    color: ComputerChip.COLORS.get("COMPONENT")
                };

                let registerName = `R${i * columnCount + j}`
                if (registerNames)
                    registerName = registerNames[i * columnCount + j];
                this.graphicComponentProperties.set(registerName, register);
                registers.set(registerName, register);
            }
        }
        return registers;
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

    protected blink(componentName: string, newColor: string | number | Color): void {
        this.changeComponentColor(componentName, newColor);
        setTimeout(() =>
                this.changeComponentColor(componentName, this.graphicComponentProperties.get(componentName).color),
            ComputerChip.ONE_SECOND);
    }

    protected getFixedArrayLength<T>(array: Array<T>): number {
        return array.filter(item => item != null).length;
    }

    protected moveInstructions(from: Instruction[], to: Instruction[], count: number): void {
        for (let i = 0; i < count; i++)
            if (!to[i] && from[0]) {
                to[i] = from.shift();
                from.push(null);
            }
    }
}
