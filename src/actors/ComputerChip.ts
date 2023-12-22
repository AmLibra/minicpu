import {Color, Mesh, MeshBasicMaterial, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {Instruction} from "../components/Instruction";
import {ComponentGraphicProperties} from "../components/ComponentGraphicProperties";
import {Queue} from "../components/Queue";

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

    // used to store the dimensions and positions of the graphic elements that make up the chip
    protected graphicComponentProperties: Map<string, ComponentGraphicProperties>;

    protected readonly graphicComponents: Map<string, Mesh>;
    protected readonly textComponents: Map<string, Mesh>;

    protected constructor(id: string, position: [number, number], scene: Scene) {
        DrawUtils.onFontLoaded(() => {
            this.initializeGraphics();
        });
        this.id = id;
        this.position = {x: position[0], y: position[1]};
        this.scene = scene;
        this.graphicComponents = new Map<string, Mesh>();
        this.graphicComponentProperties = new Map<string, ComponentGraphicProperties>();
        this.textComponents = new Map<string, Mesh>();
    }

    abstract initializeGraphics(): void;

    abstract update(): void;

    protected drawSimpleGraphicComponent(name: string): void {
        if (!this.graphicComponentProperties.has(name))
            throw new Error(`Component ${name} not found`);

        const graphicComponent = this.graphicComponentProperties.get(name);
        const component = DrawUtils.drawQuadrilateral(
            graphicComponent.width, graphicComponent.height, graphicComponent.color);
        component.position.set(this.position.x + graphicComponent.xOffset, this.position.y + graphicComponent.yOffset, 0);
        this.graphicComponents.set(name, component);
    }

    protected drawBuffer(parent: ComponentGraphicProperties, memorySize: number, margin: number, spacing: number, color: string
    ): Map<string, ComponentGraphicProperties> {
        const bufferNames: Map<string, ComponentGraphicProperties> = new Map<string, ComponentGraphicProperties>();

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

    protected drawGrid(parent: ComponentGraphicProperties, rowCount: number, columnCount: number, margin: number, registerNames?: string[]
    ): Map<string, ComponentGraphicProperties> {
        if (registerNames && registerNames.length != rowCount * columnCount) {
            throw new Error("Number of register names does not match the number of registers");
        }

        // Calculate dimensions for each individual register file, accounting for margins
        const registerWidth = (parent.width - margin * (columnCount - 1)) / columnCount;
        const registerHeight = (parent.height - margin * (rowCount - 1)) / rowCount;

        // Calculating the starting position
        const startX = parent.xOffset - parent.width / 2 + registerWidth / 2;
        const startY = parent.yOffset + parent.height / 2 - registerHeight / 2;

        const registers = new Map<string, ComponentGraphicProperties>();

        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < columnCount; j++) {
                const xOffset = startX + j * (registerWidth + margin);
                const yOffset = startY - i * (registerHeight + margin);

                const registerName = registerNames ? registerNames[i * columnCount + j] : `R${i * columnCount + j}`;
                const register = {
                    width: registerWidth,
                    height: registerHeight,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    color: ComputerChip.COLORS.get("COMPONENT")
                };

                this.graphicComponentProperties.set(registerName, register);
                registers.set(registerName, register);
            }
        }
        return registers;
    }

    protected drawTextForComponent(componentName: string, componentBuffer: Queue<Instruction>, yOffsetIncrement: number): void {
        const componentProps = this.graphicComponentProperties.get(componentName);
        if (!componentProps) {
            console.warn(`Component properties for ${componentName} not found.`);
            return;
        }

        const baseYOffset = componentProps.yOffset + componentProps.height / 2; // Calculate once

        for (let i = 0; i < componentBuffer.size(); ++i) {
            const instruction = componentBuffer.get(i);
            if (!instruction) continue; // Skip if no instruction

            const yOffset = baseYOffset - (i * yOffsetIncrement);
            const textMesh = DrawUtils.drawText(
                instruction.toString(),
                componentProps.xOffset,
                yOffset,
                ComputerChip.TEXT_SIZE,
                ComputerChip.COLORS.get("TEXT")
            );

            this.textComponents.set(`${componentName}_TEXT_${i}`, textMesh);
        }
    }

    protected changeComponentColor(componentName: string, newColor: string | number | Color): void {
        const component = this.graphicComponents.get(componentName);
        if (component && component.material instanceof MeshBasicMaterial) {
            component.material.color.set(newColor);
            component.material.needsUpdate = true;
        } else {
            console.warn(`Component '${componentName}' not found or has incompatible material`);
        }
    }


    protected blink(componentName: string, newColor: string | number | Color): void {
        this.changeComponentColor(componentName, newColor);
        setTimeout(() =>
                this.changeComponentColor(componentName, this.graphicComponentProperties.get(componentName).color),
            ComputerChip.ONE_SECOND);
    }

    protected moveInstructions(from: Queue<Instruction>, to: Queue<Instruction>, count: number): void {
        for (let i = 0; i < count; ++i) {
            if (from.isEmpty() || to.size() >= to.maxSize) break;
            to.enqueue(from.dequeue());
        }
    }

    public static toHex(value: number): string {
        return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    }
}
