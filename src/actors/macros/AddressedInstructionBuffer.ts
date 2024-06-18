import {InstructionBuffer} from "./primitives/InstructionBuffer";
import {Mesh, MeshBasicMaterial} from "three";
import {ComputerChipMacro} from "./primitives/ComputerChipMacro";
import {DrawUtils} from "../../DrawUtils";
import {InstructionMemory} from "../InstructionMemory";
import {Instruction} from "../../dataStructures/Instruction";
import {ComputerChip} from "../ComputerChip";
import {Queue} from "../../dataStructures/Queue";

/**
 * Represents an addressed version of the instruction buffer in a computer chip.
 */
export class AddressedInstructionBuffer extends InstructionBuffer {
    private addressMeshes: Mesh[] = [];
    private addressReached: number;
    private iterateMode: boolean = false;

    private requestedInstructionAddress: number = -1;

    private jumpInstructions: Map<number, Instruction> = new Map<number, Instruction>();
    private highlightedJumpPCs: number[] = [];

    private flaggedBuffers: number[] = [];
    private flaggedBufferMeshes: Mesh[] = [];

    /**
     * Returns the highest instruction address that was reached in the instruction buffer.
     */
    public highestInstructionAddress(): number {
        return this.addressReached - this.storedInstructions.maxSize + this.storedInstructions.size();
    }

    /**
     * Updates the map used to keep track of jump instructions and display them graphically.
     * @param pc the program counter of the instruction
     * @param instruction the instruction to set as a jump instruction
     */
    public setJumpInstruction(pc: number, instruction: Instruction): void {
        this.jumpInstructions.set(pc, instruction);
    }

    /**
     * Asks for the next n instructions to be fetched from the instruction memory.
     * @param chip the computer chip instance
     * @param n the number of instructions to fetch
     * @param address the address of the first instruction to fetch
     */
    public askForInstructionsAt(chip: ComputerChip, n: number, address: number): [number, MeshBasicMaterial] {
        if (this.delay == 0)
            throw new Error("There is no need to ask for instructions when there is no delay");

        const localAddress = this.toLocalAddress(address);
        if (address == this.requestedInstructionAddress && this.readTimeout > 0)
            return [-1, null];

        if (!this.storedInstructions.get(localAddress))
            return [-1, null];

        this.requestedInstructionAddress = address;
        for (let i = localAddress; i < localAddress + n; ++i)
            if (this.storedInstructions.get(i))
                this.highlightBuffer(i);

        this.readTimeout = chip.getClockFrequency() / this.parent.getClockFrequency();
        return [localAddress, this.instructionMaterial(this.storedInstructions.get(localAddress))];
    }

    /**
     * Fetches the instruction at the given address from the instruction memory.
     *
     * @param address the address of the instruction to fetch
     */
    public fetchInstructionAt(address: number): Instruction {
        if (this.delay != 0 && !this.isReadyToBeRead())
            throw new Error(`Instruction buffer from ${this.parent.displayName()} is not ready to be read`);

        const localAddress = this.toLocalAddress(address);
        const instruction = this.storedInstructions.get(localAddress);


        if (!instruction)
            return;

        this.clearHighlights();
        this.updateJumpInstructionGraphics();
        if (!this.iterateMode) {
            this.storedInstructions.remove(localAddress);
            this.shiftMeshesDown(1)
        }

        if (!this.lowestAddressIsJumpTarget(address)) {
            if (!this.iterateMode && localAddress > 0)
                this.handleForwardBranch(address)
            else
                this.clearJumpInstruction();
        }

        this.readyToBeRead = false;
        this.requestedInstructionAddress = -1;
        return instruction;
    }

    /**
     * Handles a forward branch instruction by removing the instructions before the branch target.
     * @param requestedAddress the address of the branch instruction
     */
    public handleForwardBranch(requestedAddress: number): void {
        const offset = this.toLocalAddress(requestedAddress) + 1;
        for (let i = 0; i < offset; ++i) this.storedInstructions.dequeue();
        this.shiftMeshesDown(offset);
    }

    /**
     * Clears the jump instruction from the instruction buffer and resets the graphics.
     */
    public clearJumpInstruction(): void {
        if (!this.iterateMode)
            return;
        this.iterateMode = false;
        const jumpPc = this.firstInstructionTargetingLowestAddress();
        const offset = this.toLocalAddress(jumpPc) + 1;
        for (let i = 0; i < offset; ++i) this.storedInstructions.dequeue();
        this.shiftMeshesDown(offset);
    }

    write(instructions: Queue<Instruction>, writeCount: number = instructions.size()) {
        super.write(instructions, writeCount);
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
     *
     * @private
     */
    private updateJumpInstructionGraphics(): void {
        this.jumpInstructions.forEach((instruction, pc) => {
            const localPc = this.toLocalAddress(pc);
            const localInstructionAddress = this.toLocalAddress(instruction.getAddress());
            if (!(this.highlightedJumpPCs.includes(pc)) &&
                this.isAddressInRange(localPc) && this.isAddressInRange(localInstructionAddress)) {
                this.highlightedJumpPCs.push(pc);
                this.highlightJumpAddress(localInstructionAddress);
                this.highlightIntermediateAddresses(localInstructionAddress, localPc);
            }
        });
    }

    /**
     * Checks if the given address is in the range of the instruction buffer.
     * @param address the address to check
     * @returns {boolean} true if the address is in range, false otherwise
     * @private
     */
    private isAddressInRange(address: number): boolean {
        return address < this.addressMeshes.length && address >= 0 && address < this.storedInstructions.size();
    }

    /**
     * Highlights the intermediate addresses between the start and end addresses.
     *
     * @param start the start address
     * @param end the end address
     * @private
     */
    private highlightIntermediateAddresses(start: number, end: number): void {
        const actualStart = Math.min(start, end);
        const actualEnd = Math.max(start, end);
        for (let i = actualStart; i <= actualEnd; ++i) {
            if (!this.isAddressInRange(i)) continue;

            const isNotAlreadyFlagged = !this.flaggedBuffers.includes(i);
            if (isNotAlreadyFlagged)
                this.highlightFlaggedBuffer(i);
        }
    }

    /**
     * Checks if the lowest address in the instruction buffer is a jump target.
     * @param fetchingPc the program counter of the instruction being fetched
     * @returns {boolean} true if the lowest address is a jump target, false otherwise
     * @private
     */
    private lowestAddressIsJumpTarget(fetchingPc: number): boolean {
        const lowestAddress = this.addressReached - this.storedInstructions.maxSize;
        for (const [pc, instruction] of this.jumpInstructions)
            if ((fetchingPc <= pc) && (instruction.getAddress() === lowestAddress)) {
                this.iterateMode = true;
                return true;
            }
        return false;
    }

    /**
     * Finds the first instruction that targets the lowest address in the instruction buffer.
     * @private
     */
    private firstInstructionTargetingLowestAddress(): number {
        const lowestAddress = this.addressReached - this.storedInstructions.maxSize;
        for (const [pc, instruction] of this.jumpInstructions)
            if (instruction.getAddress() === lowestAddress)
                return pc;
        throw new Error("No instruction targets the lowest address in the instruction buffer");
    }

    askForInstructions(_chip: ComputerChip, _n: number) {
        throw new Error("Method not implemented for AddressedInstructionBuffer, use askForInstructionsAt instead");
    }
}