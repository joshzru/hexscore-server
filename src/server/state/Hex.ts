import type { NodeId } from './Graph.js';

/**
 * The color of each possible player.
 */
export type Player = 'red' | 'blue' | 'white' | 'yellow' | 'green' | 'brown';

/**
 * The type of object that can be placed on a node.
 */
export type Placement = 'settlement' | 'city';

/**
 * A hex's unique identifier, derived from its axial coordinate.
 */
export type HexId = `${number},${number}`;

/**
 * Unique identifier for each type of resource.
 */
export type ResourceId =
    | 'ore'
    | 'sheep'
    | 'wheat'
    | 'brick'
    | 'wood';

/**
 * The number of unique directions you can move while still remaining adjacent
 * to a chosen hex.
 */
export const NUM_HEX_DIRECTIONS = 6;

/**
 * Array of unique directions you can move while still remaining adjacent to a
 * chosen hex, in clockwise winding order.
 * 
 * Assuming a pointy-top orientation, the first direction corresponds to the
 * hex directly to the East.
 * 
 */
export const HEX_DIRECTIONS: HexCoordinate[] = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
];

/**
 * Represents a hex's axial coordinate.
 */
export interface HexCoordinate {
    q: number;
    r: number;
}

/**
 * Represents a hex.
 */
export interface Hex {
    coordinate: HexCoordinate;
    resource?: ResourceId;
    roll?: number;
    robber: boolean;
    vertices: NodeId[];
}

/**
 * Adds two axial coordinates.
 * 
 * @param a Axial coordinate to add to the other.
 * @param b Axial coordinate to add to the other.
 * @returns The sum of `a` and `b`.
 */
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
 * Returns the coordinates adjacent to the given coordinate in clockwise cyclic
 * order.
 * 
 * Assuming the hex grid uses a pointy-top orientation, this will return them
 * in E -> SE -> SW -> W -> NW -> NE order, with the East hex being the first
 * in the array and the North-East hex being the last.
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

/**
 * Gets the id of an axial coordinate.
 * 
 * @param coordinate Axial coordinate to get the id of.
 * @returns The id of the given axial coordinate.
 */
export function hexId(coordinate: HexCoordinate): HexId {
    return `${coordinate.q},${coordinate.r}`;
}