/** Represents the different types of upgrade options available. */
export enum UpgradeOptionType {
    None,
    NumberSelection, // Used to select a number from a given range.
    SingleValueSelection, // Used to select a single value from a list of values.
}

export class UpgradeOption {
    readonly name: string;
    readonly cost: number;
    readonly type: UpgradeOptionType;
    readonly description: string;
    readonly nestedOptions: UpgradeOption[] = [];
    readonly onIncrease: () => number | boolean;
    readonly onDecrease: () => number | boolean;
    currentValue: number | boolean;

    /**
     * Initializes the UpgradeOption.
     *
     * @param name the name of the upgrade option
     * @param cost the cost of the upgrade option
     * @param type the type of the upgrade option
     * @param description the description of the upgrade option
     * @param currentValue
     * @param nestedOptions
     * @param onIncrease
     * @param onDecrease
     */
    private constructor(name: string, cost: number, type: UpgradeOptionType, description: string, currentValue: number | boolean,
                nestedOptions?: UpgradeOption[], onIncrease?: () => number | boolean, onDecrease ?: () => number | boolean) {
        this.name = name;
        this.cost = cost;
        this.type = type;
        this.description = description;
        this.currentValue = currentValue;
        this.nestedOptions = nestedOptions;
        if (this.type === UpgradeOptionType.NumberSelection) {
            if (onIncrease) {
                this.onIncrease = onIncrease;
            } else {
                throw new Error("onIncrease is required for NumberSelection type");
            }
            if (onDecrease) {
                this.onDecrease = onDecrease;
            } else {
                throw new Error("onDecrease is required for NumberSelection type");
            }
        }
    }

    /**
     * Creates a new NumberSelection UpgradeOption.
     */
    static createNumberSelection(name: string, cost: number, description: string, currentValue: number, onIncrease: () => number | boolean, onDecrease: () => number | boolean): UpgradeOption {
        return new UpgradeOption(name, cost, UpgradeOptionType.NumberSelection, description, currentValue, undefined, onIncrease, onDecrease);
    }

    /**
     * Creates a new SingleValueSelection UpgradeOption.
     */
    static createSingleValueSelection(name: string, cost: number, description: string, currentValue: boolean): UpgradeOption {
        return new UpgradeOption(name, cost, UpgradeOptionType.SingleValueSelection, description, currentValue);
    }
}