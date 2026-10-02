import { Hex, HexCoordinate, ResourceId, hexId } from "./Hex.js";

type HexId = string;

export class Board {
    private hexes = new Map<HexId, Hex>();

    getHex(coordinate: HexCoordinate): Hex | undefined {
        return this.hexes.get(hexId(coordinate));
    }

    hasHex(coordinate: HexCoordinate): boolean {
        return this.hexes.has(hexId(coordinate));
    }

    addHex(
        coordinate: HexCoordinate,
        resource: ResourceId
    ): Hex {
        if (this.hasHex(coordinate)) {
            throw new Error('A hex already exists at this coordinate');
        }

        const hex: Hex = {
            coordinate,
            resource,
        }

        this.hexes.set(hexId(coordinate), hex);
        return hex;
    }

    setHexResource(
        coordinate: HexCoordinate,
        resource: ResourceId
    ): void {
        const hex = this.getHex(coordinate);

        if ( !hex ) {
            throw new Error ('Hex does not exist.');
        }

        hex.resource = resource;
    }

    setHexRoll(
        coordinate: HexCoordinate,
        roll: number
    ): void {
        const hex = this.getHex(coordinate);

        if ( !hex ) {
            throw new Error ('Hex does not exist.');
        }

        if ( roll < 2 || roll > 12 ) {
            throw new Error('Invalid roll.');
        }

        hex.roll = roll;
    }

    getHexesForRoll(roll: number): Hex[] {
        return [...this.hexes.values()].filter(hex => hex.roll === roll);
    }
}