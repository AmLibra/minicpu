import {InstructionBuffer} from "./InstructionBuffer";
import {Mesh} from "three";
import {ComputerChipMacro} from "./ComputerChipMacro";
import {DrawUtils} from "../../DrawUtils";
import {RAM} from "../RAM";
import {Instruction} from "../../components/Instruction";
import {ComputerChip} from "../ComputerChip";
import {Queue} from "../../components/Queue";

export class AddressedInstructionBuffer extends InstructionBuffer {
    private addressMeshes: Mesh[] = [];
    private addressReached: number;
    private iterateMode: boolean = false;
    private highlightedAddressMeshes: number[] = [];
    private highlightedBufferMeshes: number[] = [];
    private potentialJumpAddress: number = -1;
    private requestedInstructionAddress: number = -1;

    public highestInstructionAddress(): number {
        return this.addressReached - this.storedInstructions.maxSize + this.storedInstructions.size();
    }

    public setPotentialJumpAddress(address: number): void {
        this.potentialJumpAddress = address;
        const localAddress = this.toLocalAddress(address);
        if (localAddress < this.addressMeshes.length)
            this.highlightJumpAddress(localAddress);
    }

    public askForInstructionsAt(chip: ComputerChip, n: number, address: number) {
        if (this.noDelay)
            throw new Error("There is no need to ask for instructions when there is no delay");
        const localAddress = this.toLocalAddress(address);
        if (address == this.requestedInstructionAddress && this.readTimeout > 0)
            return; // no need to ask for instructions if they are already being fetched

        if (!this.storedInstructions.get(localAddress))
            return; // no need to ask for instructions if there is no instruction at the address

        this.requestedInstructionAddress = address;
        for (let i = localAddress; i < localAddress + n; ++i) {
            if (this.storedInstructions.get(i))
                this.highlightBuffer(i);
        }

        this.readTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
    }

    public fetchInstructionAt(address: number): Instruction {
        if (!this.noDelay && !this.isReadyToBeRead())
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);

        console.log("fetching instruction at " + address)

        if (this.potentialJumpAddress === address)
            this.iterateMode = true;

        const localAddress = this.toLocalAddress(address);
        const instruction = this.storedInstructions.get(localAddress);
        if (!instruction)
            return;

        if (!this.iterateMode) {
            this.storedInstructions.remove(localAddress);
            this.shiftMeshesDown(1)
        }
        this.readyToBeRead = false;
        this.requestedInstructionAddress = -1;
        this.clearHighlights();
        return instruction;
    }

    public clearJumpInstruction(jumpInstructionAddress: number): void {
        console.log("clearing jump instruction at " + jumpInstructionAddress)
        if (this.iterateMode) {
            this.iterateMode = false;
            const localJumpInstructionAddress = this.toLocalAddress(jumpInstructionAddress);
            console.log(localJumpInstructionAddress)
            const localPotentialJumpAddress = this.toLocalAddress(this.potentialJumpAddress);
            console.log(localPotentialJumpAddress)
            const n = localJumpInstructionAddress - localPotentialJumpAddress;
            console.log(this.storedInstructions)
            for (let i = localPotentialJumpAddress; i < localJumpInstructionAddress; ++i)
                this.storedInstructions.dequeue();
            console.log(this.storedInstructions)
            this.shiftMeshesDown(n + 1);
            this.highlightedAddressMeshes.forEach(index => {this.addressMeshes[index].material = ComputerChipMacro.TEXT_COLOR;});
            this.highlightedAddressMeshes = [];
        }
        this.potentialJumpAddress = -1;
    }

    initializeGraphics() {
        if (this.horizontal)
            throw new Error("Horizontal instruction buffers are not supported for AddressedInstructionBuffer");
        super.initializeGraphics();
        for (let i = 0; i < this.size; i++) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(i), this.position.x - this.width / 2 - RAM.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_COLOR, true)
            this.addressMeshes[i] = addressMesh;
            this.scene.add(addressMesh);
        }
        this.addressReached = this.size;
    }

    shiftMeshesDown(nPositions: number) {
        super.shiftMeshesDown(nPositions);

        this.addressMeshes.splice(0, nPositions).forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });

        this.addressMeshes.forEach((mesh, index) => {
            mesh.position.setY(this.bufferMeshOffsets[index]);
        });

        for (let i = this.size - 1; i > this.size - nPositions - 1; --i) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(this.addressReached++), this.position.x - this.width / 2 - RAM.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_COLOR, true)
            this.addressMeshes[i] = addressMesh;
            this.scene.add(addressMesh);
        }

        console.log(this.potentialJumpAddress)
        if (this.potentialJumpAddress < 0)
            return;
        const localPotentialJumpAddress = this.toLocalAddress(this.potentialJumpAddress);
        if (localPotentialJumpAddress < this.addressMeshes.length)
            this.highlightJumpAddress(localPotentialJumpAddress);
    }

    protected highlightBuffer(index: number) {
        super.highlightBuffer(index);
        this.highlightedBufferMeshes.push(index);
    }

    clearHighlights() {
        super.clearHighlights();
        this.highlightedBufferMeshes.forEach(index => {
             const color = this.storedInstructions.get(index).isMemoryOperation() ?
            ComputerChipMacro.MEMORY_COLOR : (this.storedInstructions.get(index).isArithmetic() ?
                ComputerChipMacro.ALU_COLOR : ComputerChipMacro.BRANCH_COLOR);

            this.liveMeshes[index].material = color;
        });
    }

    dispose() {
        super.dispose();
        for (let i = 0; i < this.addressMeshes.length; i++) {
            const addressMesh = this.addressMeshes[i];
            this.scene.remove(addressMesh);
            addressMesh.geometry.dispose();
        }
        this.addressMeshes = [];
    }

    private highlightJumpAddress(address: number) {
        console.log(address)
        this.addressMeshes[address].material = ComputerChipMacro.BRANCH_COLOR;
        this.highlightedAddressMeshes.push(address);
    }

    private toLocalAddress(address: number): number {
        return this.size - this.addressReached + address;
    }

    askForInstructions(chip: ComputerChip, n: number) {
        throw new Error("Method not implemented for AddressedInstructionBuffer, use askForInstructionsAt instead");
    }
}