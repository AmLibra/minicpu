export class Queue<T> {
    private items: Array<T>;
    public readonly maxSize: number;

    constructor(maxSize: number = Infinity) {
        this.items = [];
        this.maxSize = maxSize;
    }

    // Enqueue item
    enqueue(item: T): void {
        if (this.size() >= this.maxSize) {
            throw new Error("Queue overflow error: attempting to enqueue to a full queue.");
        }
        this.items.push(item);
    }

    // Dequeue item
    dequeue(): T | undefined {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items.shift();
    }

    // Check if the queue is empty
    isEmpty(): boolean {
        return this.items.length === 0;
    }

    isFull(): boolean {
        return this.items.length === this.maxSize;
    }

    // Get the size of the queue
    size(): number {
        return this.items.length;
    }

    // Peek at the front item without removing it
    peek(): T | undefined {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items[0];
    }

    // Clear the queue
    clear(): void {
        this.items = [];
    }

    // Method to access element by index
    get(index: number): T | undefined {
        if (index < 0 || index >= this.items.length) {
            return undefined; // Out of bounds
        }
        return this.items[index];
    }

    // Method to make the Queue iterable
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