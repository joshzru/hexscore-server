import type { NodeId } from './Graph.js';

export type Player = 'red' | 'blue' | 'white' | 'yellow' | 'green' | 'brown';
export type Placement = 'settlement' | 'city';
export type HexId = `${number},${number}`;
export type ResourceId =
    | 'stone'
    | 'sheep'
    | 'wheat'
    | 'brick'
    | 'wood';

export const NUM_HEX_DIRECTIONS = 6;

// Axial coordinates
export const HEX_DIRECTIONS: HexCoordinate[] = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
];

export interface HexCoordinate {
    q: number;
    r: number;
}

export interface Hex {
    coordinate: HexCoordinate;
    resource?: ResourceId;
    roll?: number;
    vertices: NodeId[];
}

export function addCoordinates(
    a: HexCoordinate,
    b: HexCoordinate
): HexCoordinate {
    return {
        q: a.q + b.q,
        r: a.r + b.r,
    }
}

/**
 * 
 * @param coordinate The coordinate to find neighbours for.
 * @returns Each neighbour coordinate in clockwise cyclic order.
 */
export function getNeighborCoordinates(
    coordinate: HexCoordinate
): HexCoordinate[] {
    return HEX_DIRECTIONS.map(direction =>
        addCoordinates(coordinate, direction)
    );
}

export function hexId(coordinate: HexCoordinate): HexId {
    return `${coordinate.q},${coordinate.r}`;
}