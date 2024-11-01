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
     * @param items - The items to initialize the queue with.
     */
    constructor(maxSize: number = Infinity, ...items: T[]) {
        this.items = items;
        this.maxSize = maxSize;
    }

    /**
     * Constructs a new instance of Queue with the specified items and maximum size.
     *
     * @param {T[]} items - The items to initialize the queue with.
     */
    static of<U>(...items: U[]): Queue<U> {
        return new Queue<U>(Infinity, ...items);
    }

    /**
     * Converts this queue to an array.
     *
     * @returns {T[]} An array containing the items in the queue.
     */
    toArray(): T[] {
        return this.items.slice();
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
            to.enqueue(this.dequeue()!);
        }
    }

    /**
     * Checks if the queue contains the specified item.
     *
     * @param {T} item - The item to search for.
     * @returns {boolean} True if the item is found, false otherwise.
     */
    contains(item: T): boolean {
        return this.items.includes(item);
    }

    /**
     * Checks if any item in the queue satisfies the provided predicate.
     *
     * @param {function(T): boolean} predicate - The predicate function to apply to each item.
     * @returns {boolean} True if the predicate is satisfied by any item, false otherwise.
     */
    some(predicate: (item: T) => boolean): boolean {
        return this.items.some(predicate);
    }

    /**
     * Checks if all items in the queue satisfy the provided predicate.
     *
     * @param {function(T): boolean} predicate - The predicate function to apply to each item.
     * @returns {boolean} True if the predicate is satisfied by all items, false otherwise.
     */
    every(predicate: (item: T) => boolean): boolean {
        return this.items.every(predicate);
    }

    /**
     * Returns a new queue containing only the items that satisfy the provided predicate.
     *
     * @param {function(T): boolean} predicate - The predicate function to apply to each item.
     * @returns {Queue<T>} A new queue containing only the items that satisfy the predicate.
     */
    filter(predicate: (item: T) => boolean): Queue<T> {
        return new Queue<T>(this.maxSize, ...this.items.filter(predicate));
    }

    /**
     * Returns a slice of the queue as a new queue.
     *
     * @param {number} [start=0] - The index at which to begin the slice.
     * @param {number} [end=this.size()] - The index at which to end the slice.
     * @returns {Queue<T>} A new queue containing the specified slice of items.
     * @throws {Error} If the start or end index is out of bounds.
     * @throws {Error} If the start index is greater than the end index.
     */
    slice(start: number = 0, end: number = this.size()): Queue<T> {
        if (this.size() == 0) {
            return new Queue<T>(this.maxSize);
        }
        if (start < 0 || start >= this.size() || end < 0 || end > this.size()) {
            throw new Error("Index out of bounds error: attempting to slice queue outside of bounds.");
        }
        if (start > end) {
            throw new Error("Invalid index error: start index must be less than or equal to end index.");
        }
        return new Queue<T>(this.maxSize, ...this.items.slice(start, end));
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
