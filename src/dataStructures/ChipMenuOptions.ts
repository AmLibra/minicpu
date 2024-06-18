import {Stat} from "./Stat";
import {UpgradeOption} from "./UpgradeOption";

/** Represents the options available for a chip menu. */
export class ChipMenuOptions {
    readonly stats: Stat[];
    readonly upgradeOptions: UpgradeOption[];

    /**
     * Initializes the ChipMenuOptions.
     *
     * @param stats The stats to display.
     * @param upgradeOptions The upgrade options to display.
     */
    constructor(stats: Stat[], upgradeOptions: UpgradeOption[]) {
        this.stats = stats;
        this.upgradeOptions = upgradeOptions;
    }
}