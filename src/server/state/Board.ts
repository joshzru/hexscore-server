import { NodeId, Graph } from "./Graph.js";
import { NUM_HEX_DIRECTIONS, Hex, HexCoordinate, ResourceId, getNeighborCoordinates, hexId } from "./Hex.js";
import { Player } from "./Hex.js";

const incrementHexIndx = (indx: number): number => (indx + 1) % NUM_HEX_DIRECTIONS;

type HexId = string;

export class Board {
    private hexes = new Map<HexId, Hex>();
    private graph = new Graph();
    largestArmy?: Player = undefined;

    getHex(coordinate: HexCoordinate): Hex | undefined {
        return this.hexes.get(hexId(coordinate));
    }

    hasHex(coordinate: HexCoordinate): boolean {
        return this.hexes.has(hexId(coordinate));
    }

    addHex(coordinate: HexCoordinate): Hex {
        if (this.hasHex(coordinate)) {
            throw new Error('A hex already exists at this coordinate');
        }

        // TODO: Add nodes and edges into the graph for this hex.
        // Get all adjacent hexes, if they exist, they contain up to two of
        // the vertices for this hex.
        // Then create all remaining vertices and edges that don't exist.
        // Shared vertices given a direction.
        //
        // { q: 1, r: 0 }
        // index: 0 and 1
        //
        // { q: 0, r: 1 }
        // index: 1 and 2
        //
        // { q: -1, r: 1 },
        // index: 2 and 3
        //
        // { q: -1, r: 0 },
        // index: 3 and 4
        //
        // { q: 0, r: -1 },
        // index: 4 and 5
        //
        // { q: 1, r: -1 },
        // index 5 and 0

        const vertices: (NodeId | undefined)[] = new Array(NUM_HEX_DIRECTIONS)
            .fill(undefined)
        let nodeAIndx = 0; // 0th index
        let nodeBIndx = 1; // 1st index
        let neighbourAIndx = 4 // 4th index of neighbor
        let neighbourBIndx = 3 // 3rd index of neighbor

        // getNeighborCoordinates returns them in axial order
        // Assign any existing nodes from adjacent hexes.
        for ( const neighborCoord of getNeighborCoordinates(coordinate) ) {
            const neighborHex = this.getHex(neighborCoord);

            if ( neighborHex ) {
                vertices[nodeAIndx] = neighborHex.vertices[neighbourAIndx];
                vertices[nodeBIndx] = neighborHex.vertices[neighbourBIndx];
            }

            nodeAIndx = incrementHexIndx(nodeAIndx);
            nodeBIndx = incrementHexIndx(nodeBIndx);
            neighbourAIndx = incrementHexIndx(neighbourAIndx);
            neighbourBIndx = incrementHexIndx(neighbourBIndx);
        }

        // Create all nodes that don't exist.
        const vertexNodes: NodeId[] = vertices.map(pNode => {
            if ( pNode !== undefined ) return pNode;
            return this.graph.addNode();
        })

        // Create all edges that don't exist.
        const edgeArray = [...vertexNodes, vertexNodes[0]];
        for ( let i = 0; i < NUM_HEX_DIRECTIONS; i++ ) {
            const leftNode = edgeArray[i];
            const rightNode = edgeArray[i + 1];

            if ( !this.graph.hasEdgeBetween(leftNode, rightNode) ) {
                this.graph.addEdge(leftNode, rightNode);
            }
        }

        const hex: Hex = {
            coordinate,
            vertices: vertexNodes,
        }

        this.hexes.set(hexId(coordinate), hex);
        return hex;
    }

    popHex(coordinate: HexCoordinate): Hex | undefined {
        const hex = this.hexes.get(hexId(coordinate));

        if ( !hex ) return undefined;

        this.deleteHex(coordinate);
        return hex;
    }

    deleteHex(coordinate: HexCoordinate): boolean {
        // TODO: Remove nodes and edges that no longer have a corresponding hex.
        return this.hexes.delete(hexId(coordinate));
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

    getState(): Hex[] {
        return [...this.hexes.values()];
    }
}