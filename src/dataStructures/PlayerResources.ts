/** Used to store the resources of the player. */
export class PlayerResources {
    private readonly power: number;

    /**
     * Constructs a new PlayerResources instance.
     *
     * @param power the power stat in Watts of the player
     */
    constructor(power: number) {
        this.power = power;
    }
}