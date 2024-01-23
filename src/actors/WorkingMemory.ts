import {ComputerChip} from "./ComputerChip";
import {Mesh, PlaneGeometry, Scene} from "three";
import {DrawUtils} from "../DrawUtils";
import {CPU} from "./CPU";
import {DataCellArray} from "./DataCellArray";

export class WorkingMemory extends ComputerChip {
    public readonly size: number;
    public readonly numberOfBanks: number;
    private readonly numberOfWords: number;
    private readonly wordSize: number;

    private dataBanks: DataCellArray[] = [];
    private static BANK_SPACING: number = 0.04;

    constructor(position: [number, number], scene: Scene, clockFrequency: number, numberOfBanks: number = 2, numberOfWords: number = 4, wordSize: number = 4) {
        super(position, scene, clockFrequency);
        this.numberOfWords = numberOfWords;
        this.numberOfBanks = numberOfBanks;
        this.wordSize = wordSize;
        this.size = numberOfBanks * numberOfWords * wordSize;
        this.initializeGraphics();
    }

    public isReady(address: number): boolean {
        return this.bankOf(address).isReady();
    }

    public askForMemoryOperation(cpu: CPU, address: number): void {
        this.bankOf(address).askForMemoryOperation(cpu, address % this.bankOf(address).getSize());
    }

    public read(address: number): number {
        return this.bankOf(address).read(address % this.bankOf(address).getSize());
    }

    public write(address: number, value: number): void {
        this.bankOf(address).write(address % this.bankOf(address).getSize(), value);
    }

    displayName(): string {
        return "Main Memory";
    }

    update(): void {
        this.dataBanks.forEach(dataBank => dataBank.update());
    }

    computeMeshProperties(): void {
    }

    drawUpdate(): void {
    }

    private initializeGraphics(): void {
        const tmpDataBank = new DataCellArray(this, 0, 0, this.numberOfWords, this.wordSize);
        const bodyHeight = tmpDataBank.height + WorkingMemory.CONTENTS_MARGIN * 2 + WorkingMemory.INNER_SPACING +
            WorkingMemory.TEXT_SIZE;
        let bodyWidth = tmpDataBank.width * this.numberOfBanks + WorkingMemory.CONTENTS_MARGIN * 2
            + (this.numberOfBanks - 1) * WorkingMemory.BANK_SPACING;

        const startOffset = -bodyWidth / 2 + tmpDataBank.width / 2 + WorkingMemory.CONTENTS_MARGIN;
        for (let i = 0; i < this.numberOfBanks; i++) {
            const dataBank = new DataCellArray(this, startOffset + i * (tmpDataBank.width + WorkingMemory.BANK_SPACING),
                (- WorkingMemory.INNER_SPACING - WorkingMemory.TEXT_SIZE) / 2 , this.numberOfWords, this.wordSize, `Bank ${i}`);
            dataBank.initializeGraphics();
            this.dataBanks[i] = dataBank;
        }
        tmpDataBank.dispose();

        this.buildBodyMesh(bodyWidth, bodyHeight);
        this.drawPins(this.bodyMesh, 'top', this.size).forEach((mesh, _name) => this.scene.add(mesh));
    }

    private bankOf(address: number): DataCellArray {
        console.log(Math.floor(address / this.dataBanks[0].getSize()));
        return this.dataBanks[Math.floor(address / this.dataBanks[0].getSize())];
    }
}