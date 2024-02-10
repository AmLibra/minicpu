import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {Mesh, MeshBasicMaterial} from "three";
import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
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
    private toHighlightJumpPointer = 0;

    private flaggedBuffers: number[] = [];
    private flaggedBufferMeshes: Mesh[] = [];

    /**
     * Returns the highest instruction address that was reached in the instruction buffer.
     */
    public highestInstructionAddress(): number {
        return this.addressReached - this.storedInstructions.maxSize + this.storedInstructions.size();
    }

    /**
     * Used to set the jump address and the address of the instruction that caused the jump.
     * @param jumpAddress the address to jump to
     * @param jumpInstructionAddress the address of the instruction that caused the jump
     */
    public setJumpAddress(jumpAddress: number, jumpInstructionAddress: number): void {
        this.jumpAddressQueue.enqueue(jumpAddress);
        this.jumpInstructionQueue.enqueue(jumpInstructionAddress);
    }

    /**
     * Asks for the next n instructions to be fetched from the instruction memory.
     * @param chip the computer chip instance
     * @param n the number of instructions to fetch
     * @param address the address of the first instruction to fetch
     */
    public askForInstructionsAt(chip: ComputerChip, n: number, address: number) {
        if (this.delay == 0)
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

    /**
     * Fetches the instruction at the given address from the instruction memory.
     *
     * @param address the address of the instruction to fetch
     */
    public fetchInstructionAt(address: number): Instruction {
        if (this.delay != 0 && !this.isReadyToBeRead())
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
        }

        this.readyToBeRead = false;
        this.requestedInstructionAddress = -1;
        return instruction;
    }

    /**
     * Clears the jump instruction from the instruction buffer and resets the graphics.
     */
    public clearJumpInstruction(): void {
        if (!this.iterateMode)
            return;

        this.iterateMode = false;
        const n = this.toLocalAddress(this.jumpInstructionQueue.dequeue()) - this.toLocalAddress(this.jumpAddressQueue.dequeue()) + 1;
        for (let i = 0; i < n; ++i) this.storedInstructions.dequeue();

        this.highlightMeshes.forEach((mesh, index) => mesh.position.setY(this.bufferMeshOffsets[this.highlightedBufferMeshes[index] - n]));
        this.highlightedBufferMeshes = this.highlightedBufferMeshes.map(index => index - n);
        this.shiftMeshesDown(n);
        this.toHighlightJumpPointer--;
    }

    write(instructions: Queue<Instruction>, writeCount: number = instructions.size()) {
        super.write(instructions, writeCount);
        const jumpInstructionAddress = this.jumpInstructionQueue.get(this.toHighlightJumpPointer);
        if (jumpInstructionAddress && this.storedInstructions.size() > this.toLocalAddress(jumpInstructionAddress))
            this.updateJumpInstructionGraphics(this.toHighlightJumpPointer++);
    }

    initializeGraphics() {
        if (this.horizontal)
            throw new Error("Horizontal instruction buffers are not supported for AddressedInstructionBuffer");
        super.initializeGraphics();
        for (let i = 0; i < this.size; i++) {
            const addressMesh = DrawUtils.buildTextMesh(DrawUtils.toHex(i),
                this.position.x - this.width / 2 - InstructionMemory.ADDRESS_MARGIN * 0.6,
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

        //this.addressMeshes.forEach((mesh, index) => mesh.position.setY(this.bufferMeshOffsets[index]));
        this.addressMeshes.forEach((mesh, index) =>
            mesh.translateY(this.bufferMeshOffsets[index] - this.bufferMeshOffsets[index + nPositions]));

        // Update flagged buffer indices and their mesh positions
        this.flaggedBuffers = this.flaggedBuffers.map(index => index - nPositions);
        this.flaggedBufferMeshes.forEach((mesh, index) => {
            const newIndex = this.flaggedBuffers[index];
            if (newIndex >= 0) {
                mesh.position.y = this.bufferMeshOffsets[newIndex];
            } else {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                this.flaggedBufferMeshes[index] = null;
            }
        });
        this.flaggedBuffers = this.flaggedBuffers.filter(index => index >= 0);
        this.flaggedBufferMeshes = this.flaggedBufferMeshes.filter(mesh => mesh !== null);

        for (let i = this.size - nPositions; i < this.size; ++i) {
            const addressMesh =
                DrawUtils.buildTextMesh(DrawUtils.toHex(this.addressReached++),
                    this.position.x - this.width / 2 - InstructionMemory.ADDRESS_MARGIN * 0.6,
                    this.bufferMeshOffsets[i], ComputerChipMacro.TEXT_SIZE * 0.8,
                    ComputerChipMacro.TEXT_MATERIAL, true)
            this.addressMeshes[i] = addressMesh;
            this.scene.add(addressMesh);
        }
    }

    highlightBuffer(index: number) {
        super.highlightBuffer(index);
        if (this.storedInstructions.get(index))
            this.highlightedBufferMeshes.push(index);
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

    /**
     * Highlights the buffer at the given index, using the BRANCH_MATERIAL color and a low opacity.
     * @param index the index of the buffer to highlight
     * @private
     */
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

    /**
     * Highlights the address mesh of the given instruction address.
     * @param address the address to highlight
     * @private
     */
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

    /**
     * Updates the graphics of a given jump instruction and the intermediate addresses.
     * @param index the index of the jump instruction
     * @private
     */
    private updateJumpInstructionGraphics(index: number): void {
        const jumpAddress = this.jumpAddressQueue.get(index);
        const jumpInstructionAddress = this.jumpInstructionQueue.get(index);
        if (!this.isValidAddress(jumpAddress) || !this.isValidAddress(jumpInstructionAddress)) return;

        const localJumpAddress = this.toLocalAddress(jumpAddress);
        const localInstructionAddress = this.toLocalAddress(jumpInstructionAddress);

        if (this.isAddressInRange(localJumpAddress) && this.isAddressInRange(localInstructionAddress)) {
            this.highlightJumpAddress(localJumpAddress);
            this.highlightIntermediateAddresses(localJumpAddress, localInstructionAddress);
        }
    }

    /**
     * Checks if the given address is valid.
     * @param address the address to check
     * @returns {boolean} true if the address is valid, false otherwise
     * @private
     */
    private isValidAddress(address: number): boolean {
        return address !== undefined && address !== null;
    }

    /**
     * Checks if the given address is in the range of the instruction buffer.
     * @param address the address to check
     * @returns {boolean} true if the address is in range, false otherwise
     * @private
     */
    private isAddressInRange(address: number): boolean {
        return address < this.addressMeshes.length && address >= 0;
    }

    /**
     * Highlights the intermediate addresses between the start and end addresses.
     *
     * @param start the start address
     * @param end the end address
     * @private
     */
    private highlightIntermediateAddresses(start: number, end: number): void {
        for (let i = start; i <= end; ++i) {
            if (!this.isAddressInRange(i)) continue;

            const isNotAlreadyFlagged = !this.flaggedBuffers.includes(i);
            if (isNotAlreadyFlagged)
                this.highlightFlaggedBuffer(i);
        }
    }

    askForInstructions(chip: ComputerChip, n: number) {
        throw new Error("Method not implemented for AddressedInstructionBuffer, use askForInstructionsAt instead");
    }
}