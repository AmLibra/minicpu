/**
 * Queue data structure implementation in TypeScript
 * @class Queue
 * @template T
 * @constructor
 * @param {number} maxSize - The maximum size of the queue
 * @property {Array<T>} items - The items in the queue
 * @property {number} maxSize - The maximum size of the queue
 */
export class Queue<T> {
    private items: Array<T>;
    public readonly maxSize: number;

    constructor(maxSize: number = Infinity) {
        this.items = [];
        this.maxSize = maxSize;
    }

    /**
     * Enqueue item (add to the end of the queue)
     *
     * @param item - The item to be enqueued
     */
    enqueue(item: T): void {
        if (this.size() >= this.maxSize) {
            throw new Error("Queue overflow error: attempting to enqueue to a full queue.");
        }
        this.items.push(item);
    }

    /**
     * Dequeue item (remove from the front of the queue)
     *
     * @returns {T} The dequeued item
     */
    dequeue(): T | undefined {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items.shift();
    }

    /**
     * Check if the queue is empty
     */
    isEmpty(): boolean {
        return this.items.length === 0;
    }

    /**
     * Check if the queue is full
     */
    isFull(): boolean {
        return this.items.length === this.maxSize;
    }

    /**
     * Get the size of the queue
     */
    size(): number {
        return this.items.length;
    }

    /**
     * Peek at the front of the queue
     *
     * @returns {T} The item at the front of the queue
     */
    peek(): T | undefined {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items[0];
    }

    /**
     * Clear (empty) the queue
     */
    clear(): void {
        this.items = [];
    }

    /**
     * Get the item at the specified index
     *
     * @param {number} index - The index of the item to be retrieved
     * @returns {T} The item at the specified index
     */
    get(index: number): T | undefined {
        if (index < 0 || index >= this.items.length) {
            return undefined; // Out of bounds
        }
        return this.items[index];
    }

    /**
     * Used to iterate over the queue
     * @returns {Iterator<T>} The iterator
     * @example
     * for (let item of queue) {
     *    console.log(item);
     * }
     */
    [Symbol.iterator](): Iterator<T> {
        let pointer = 0;
        let items = this.items;

        return {
            next(): IteratorResult<T> {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++]
                    };
                } else {
                    return {
                        done: true,
                        value: null
                    };
                }
            }
        };
    }
}