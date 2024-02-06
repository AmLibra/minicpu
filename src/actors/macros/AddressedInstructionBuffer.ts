import {InstructionBuffer} from "./InstructionBuffer";
import {Mesh, MeshBasicMaterial} from "three";
import {ComputerChipMacro} from "./ComputerChipMacro";
import {DrawUtils} from "../../DrawUtils";
import {InstructionMemory} from "../InstructionMemory";
import {Instruction} from "../../components/Instruction";
import {ComputerChip} from "../ComputerChip";
import {Queue} from "../../components/Queue";

/**
 * Represents an addressed version of the instruction buffer in a computer chip.
 */
export class AddressedInstructionBuffer extends InstructionBuffer {
    private addressMeshes: Mesh[] = [];
    private addressReached: number;
    private iterateMode: boolean = false;
    private highlightedBufferMeshes: number[] = [];

    private jumpAddressQueue: Queue<number> = new Queue<number>();
    private jumpInstructionQueue: Queue<number> = new Queue<number>();
    private requestedInstructionAddress: number = -1;

    private flaggedBuffers: number[] = [];
    private flaggedBufferMeshes: Mesh[] = [];

    public highestInstructionAddress(): number {
        return this.addressReached - this.storedInstructions.maxSize + this.storedInstructions.size();
    }

    public setJumpAddress(jumpAddress: number, jumpInstructionAddress: number): void {
        this.jumpAddressQueue.enqueue(jumpAddress);
        this.jumpInstructionQueue.enqueue(jumpInstructionAddress);
        this.checkJumpInstructionGraphics();
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
        for (let i = localAddress; i < localAddress + n; ++i)
            if (this.storedInstructions.get(i))
                this.highlightBuffer(i);


        this.readTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
    }

    public fetchInstructionAt(address: number): Instruction {
        if (!this.noDelay && !this.isReadyToBeRead())
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);

        if (this.jumpAddressQueue.peek() == address && !this.iterateMode)
            this.iterateMode = true;

        const localAddress = this.toLocalAddress(address);
        const instruction = this.storedInstructions.get(localAddress);
        if (!instruction)
            return;

        this.clearHighlights();
        if (!this.iterateMode) {
            this.storedInstructions.remove(localAddress);
            this.shiftMeshesDown(1)
        } else { // iterate mode clear previously highlighted buffers
            this.clearHighlights();
            this.checkJumpInstructionGraphics();
        }

        this.readyToBeRead = false;
        this.requestedInstructionAddress = -1;
        return instruction;
    }

    public clearJumpInstruction(): void {
        if (!this.iterateMode)
            return;

        this.clearHighlights();
        this.iterateMode = false;
        const n = this.toLocalAddress(this.jumpInstructionQueue.dequeue()) - this.toLocalAddress(this.jumpAddressQueue.dequeue());
        for (let i = 0; i < n; ++i)
            this.storedInstructions.dequeue();
        this.flaggedBufferMeshes.splice(0, n).forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.flaggedBuffers.splice(0, n);

        this.shiftMeshesDown(n);
    }

    initializeGraphics() {
        if (this.horizontal)
            throw new Error("Horizontal instruction buffers are not supported for AddressedInstructionBuffer");
        super.initializeGraphics();
        for (let i = 0; i < this.size; i++) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(i), this.position.x - this.width / 2 - InstructionMemory.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_MATERIAL, true)
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

        this.addressMeshes.forEach((mesh, index) => mesh.position.setY(this.bufferMeshOffsets[index]));

        this.flaggedBuffers = this.flaggedBuffers.map(index => index - nPositions);

        this.flaggedBufferMeshes.forEach((mesh, index) => mesh.position.setY(this.bufferMeshOffsets[this.flaggedBuffers[index]]));

        for (let i = this.size - 1; i > this.size - nPositions - 1; --i) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(this.addressReached++), this.position.x - this.width / 2 - InstructionMemory.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_MATERIAL, true)
            this.addressMeshes[i] = addressMesh;
            this.scene.add(addressMesh);
        }

        if (this.jumpAddressQueue.peek())
            this.checkJumpInstructionGraphics();
    }

    highlightBuffer(index: number) {
        super.highlightBuffer(index);
        if (this.storedInstructions.get(index))
            this.highlightedBufferMeshes.push(index);
    }

    private highlightFlaggedBuffer(index: number) {
        this.clearHighlights();
        const material = new MeshBasicMaterial({
            color: ComputerChipMacro.BRANCH_MATERIAL.color, // Use the color from BRANCH_MATERIAL
            transparent: true,
            opacity: 0.1,
        });
        const highlightMesh = new Mesh(this.bufferHighlightGeometry, material);
        highlightMesh.position.set(this.horizontal ? this.bufferMeshOffsets[index] : this.position.x,
            this.horizontal ? this.position.y : this.bufferMeshOffsets[index], 0.01);
        this.flaggedBufferMeshes.push(highlightMesh);
        this.flaggedBuffers.push(index);
        this.scene.add(highlightMesh);
    }

    clearHighlights() {
        super.clearHighlights();
        this.highlightedBufferMeshes.forEach(index => {
            if (!this.storedInstructions.get(index)) return;
            this.liveMeshes[index].material = this.instructionMaterial(this.storedInstructions.get(index));
        });
        this.highlightedBufferMeshes = [];
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
        this.addressMeshes[address].material = ComputerChipMacro.BRANCH_MATERIAL;
    }

    /**
     * Converts the given address to a local address in the instruction buffer.
     * @param address the address to convert
     * @private
     */
    private toLocalAddress(address: number): number {
        return this.size - this.addressReached + address;
    }

    private checkJumpInstructionGraphics() {
        const jumpAddress = this.jumpAddressQueue.peek();
        const jumpInstructionAddress = this.jumpInstructionQueue.peek();

        if (!this.isValidAddress(jumpAddress) || !this.isValidAddress(jumpInstructionAddress)) return;

        const localJumpAddress = this.toLocalAddress(jumpAddress);
        const localInstructionAddress = this.toLocalAddress(jumpInstructionAddress);

        if (this.isAddressInRange(localJumpAddress) || this.iterateMode)
            this.highlightJumpAddress(localJumpAddress);

        this.highlightIntermediateAddresses(localJumpAddress, localInstructionAddress);
    }

    private isValidAddress(address: number): boolean {
        return address !== undefined && address !== null;
    }

    private isAddressInRange(address: number): boolean {
        return address < this.addressMeshes.length && address >= 0;
    }

    private highlightIntermediateAddresses(start: number, end: number): void {
        for (let i = start; i < end; ++i) {
            if (!this.isAddressInRange(i)) continue;

            const instructionExists = this.storedInstructions.get(i);
            const isAlreadyFlagged = this.flaggedBuffers.includes(i);

            if (instructionExists && !isAlreadyFlagged)
                this.highlightFlaggedBuffer(i);
        }
    }

    askForInstructions(chip: ComputerChip, n: number) {
        throw new Error("Method not implemented for AddressedInstructionBuffer, use askForInstructionsAt instead");
    }
}