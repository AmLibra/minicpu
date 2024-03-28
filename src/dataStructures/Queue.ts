/**
 * A generic queue data structure with a configurable maximum size.
 * Supports basic queue operations like enqueue, dequeue, and inspection.
 *
 * @template T The type of elements in the queue.
 */
export class Queue<T> {
    private items: Array<T>;
    public readonly maxSize: number;

    /**
     * Constructs a new instance of Queue.
     *
     * @param {number} [maxSize=Infinity] - The maximum number of items that the queue can hold.
     */
    constructor(maxSize: number = Infinity, ...items: T[]) {
        this.items = items;
        this.maxSize = maxSize;
    }

    /**
     * Constructs a new instance of Queue with the specified items and maximum size.
     *
     * @param {number} maxSize - The maximum number of items that the queue can hold.
     * @param {T[]} items - The items to initialize the queue with.
     */
    static of<U>(...items: U[]): Queue<U> {
        return new Queue<U>(Infinity, ...items);
    }

    /**
     * Adds an item to the end of the queue.
     *
     * @param {T} item - The item to add to the queue.
     * @throws {Error} If the queue is at its maximum capacity.
     */
    enqueue(item: T): void {
        if (this.isFull()) {
            throw new Error("Queue overflow error: attempting to enqueue to a full queue.");
        }
        this.items.push(item);
    }

    /**
     * Removes and returns the item at the front of the queue.
     *
     * @returns {T | undefined} The item at the front of the queue, or undefined if the queue is empty.
     */
    dequeue(): T | undefined {
        return this.items.shift();
    }

    /**
     * Checks if the queue is empty.
     *
     * @returns {boolean} True if the queue is empty, false otherwise.
     */
    isEmpty(): boolean {
        return this.items.length === 0;
    }

    /**
     * Checks if the queue is full.
     *
     * @returns {boolean} True if the queue has reached its maximum size, false otherwise.
     */
    isFull(): boolean {
        return this.items.length >= this.maxSize;
    }

    /**
     * Returns the number of items in the queue.
     *
     * @returns {number} The number of items in the queue.
     */
    size(): number {
        return this.items.length;
    }

    /**
     * Removes all items from the queue.
     */
    clear(): void {
        this.items = [];
    }

    /**
     * Retrieves the item at the specified index without removing it.
     *
     * @param {number} index - The zero-based index of the item to retrieve.
     * @returns {T | undefined} The item at the specified index, or undefined if the index is out of bounds.
     */
    get(index: number): T | undefined {
        if (index < 0 || index >= this.items.length) {
            return undefined; // Out of bounds
        }
        return this.items[index];
    }

    /**
     * Removes and returns the item at the specified index.
     *
     * @param {number} index - The zero-based index of the item to remove.
     * @returns {T | undefined} The removed item, or undefined if the index is out of bounds.
     */
    remove(index: number): T | undefined {
        if (index < 0 || index >= this.items.length) {
            return undefined; // Out of bounds
        }
        return this.items.splice(index, 1)[0];
    }

    /**
     * Returns the item at the front of the queue without removing it.
     *
     * @returns {T | undefined} The item at the front of the queue, or undefined if the queue is empty.
     */
    peek(): T | undefined {
        return this.items[0];
    }

    /**
     * Moves a specified number of items from this queue to another queue.
     *
     * @param {Queue<T>} to - The destination queue.
     * @param {number} [count=this.size()] - The maximum number of items to move.
     */
    moveTo(to: Queue<T>, count: number = this.size()): void {
        for (let i = 0; i < Math.min(count, to.maxSize); ++i) {
            if (this.isEmpty() || to.isFull()) break;
            to.enqueue(this.dequeue());
        }
    }

    /**
     * Creates an iterator for the queue, allowing it to be used in for...of loops.
     *
     * @returns {Iterator<T>} An iterator for the queue.
     */
    [Symbol.iterator](): Iterator<T> {
        let pointer = 0;
        const items = this.items;

        return {
            next(): IteratorResult<T> {
                if (pointer < items.length) {
                    return {done: false, value: items[pointer++]};
                } else {
                    return {done: true, value: null};
                }
            }
        };
    }

    /**
     * Returns a string representation of the queue.
     *
     * @returns {string} A string representation of the queue.
     */
    toString(): string {
        return this.items.toString();
    }
}
