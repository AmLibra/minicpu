import {TextButton} from "../hudElements/TextButton";
import {TextButtonBuilder} from "../hudElements/TextButtonBuilder";

/** Represents a stat for a computer chip. */
export class Stat {
    readonly name: string;
    readonly value: string;
    readonly unit: string | undefined;
    readonly button: TextButtonBuilder | undefined;

    /**
     * Constructs a new Stat instance.
     *
     * @param name the name of the stat
     * @param value the value of the stat
     * @param unit the unit of the stat
     * @param button a potential button to interact with the stat
     */
    constructor(name: string, value: string, unit?: string, button?: TextButtonBuilder) {
        this.name = name;
        this.value = value;
        this.unit = unit;
        this.button = button;
    }
}