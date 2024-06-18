/** Represents a stat for a computer chip. */
export class Stat {
    readonly name: string;
    readonly value: number;
    readonly unit: string;

    /**
     * Constructs a new Stat instance.
     *
     * @param name the name of the stat
     * @param value the value of the stat
     * @param unit the unit of the stat
     */
    constructor(name: string, value: number, unit: string) {
        this.name = name;
        this.value = value;
        this.unit = unit;
    }
}