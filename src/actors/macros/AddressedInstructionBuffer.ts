import {InstructionBuffer} from "./InstructionBuffer";
import {Mesh} from "three";
import {ComputerChipMacro} from "./ComputerChipMacro";
import {DrawUtils} from "../../DrawUtils";
import {RAM} from "../RAM";
import {Instruction} from "../../components/Instruction";

export class AddressedInstructionBuffer extends InstructionBuffer {
    private readonly addressMeshes: Mesh[] = [];
    private addressReached: number;
    private iterateMode: boolean = false;

    initializeGraphics() {
        super.initializeGraphics();
        for (let i = 0; i < this.size; i++) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(i), this.position.x - this.width / 2 - RAM.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_COLOR, true)
            this.addressMeshes.push(addressMesh);
            this.scene.add(addressMesh);
        }
        this.addressReached = this.size;
    }

    shiftMeshesDown(nPositions: number) {
        super.shiftMeshesDown(nPositions);
        this.addressMeshes.splice(0, nPositions).forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose()
        });
        this.addressMeshes.forEach((mesh, index) => mesh.translateY(-this.bufferMeshOffsets[index + nPositions] + this.bufferMeshOffsets[index]));
        for (let i = 0; i < nPositions; i++) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(this.addressReached++), this.position.x - this.width / 2 - RAM.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[this.size - nPositions + i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_COLOR, true)
            this.addressMeshes.push(addressMesh);
            this.scene.add(addressMesh);
        }
    }

    dispose() {
        super.dispose();
        this.addressMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose()
        });
    }

    public fetchInstructionAt(address: number): Instruction {
        if (!this.noDelay && !this.isReadyToBeRead())
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);
        const localAddress = this.size - (this.addressReached - address);
        if (!this.storedInstructions.get(localAddress))
            return;

        this.highlightBuffer(localAddress);
        this.readyToBeRead = false;
        return this.storedInstructions.get(localAddress);
    }
}