import {
    NodeId,
    Graph,
    GraphNode,
    GraphEdge,
    EdgeId
} from "./Graph.js";
import {
    NUM_HEX_DIRECTIONS,
    Hex,
    HexCoordinate,
    ResourceId,
    getNeighborCoordinates,
    hexId
} from "./Hex.js";
import { Player } from "./Hex.js";

/**
 * Advances a hex index by one, wrapping around to zero when the index reaches
 * the number of hex directions
 * 
 * @param indx The current index
 * @returns The next index, wrapped within the valid range
 */
const nextHexIndx = (indx: number): number =>
    (indx + 1) % NUM_HEX_DIRECTIONS;

/**
 * Unique identifier for each hex.
 * 
 * Generated from their axial coordinate using {@link hexId}.
 */
type HexId = string;

/**
 * Represents a hex-based board and the underlying graph of nodes and edges.
 * 
 * Manages hex tiles, hex vertices as nodes, and hex sides as edges, resource
 * production, robber's position, player scores, and other game actions and
 * state.
 * 
 * The underlying graph is represented by a {@link Graph}.
 */
export class Board {
    /**
     * Maps each hex's id to its corresponding hex tile.
     */
    private hexes = new Map<HexId, Hex>();

    /**
     * Graph representing the board's vertices and edges.
     */
    graph = new Graph();

    /**
     * The player currently holding the largest army.
     * 
     * Undefined when no player holds it.
     * 
     * Counts for two victory points.
     */
    largestArmy?: Player;

    /**
     * The player currently holding the largest army.
     * 
     * Undefined when no player holds it.
     * 
     * Counts for two victory points.
     */
    longestRoad?: Player;

    /**
     * Coordinate of the hex the robber is currently occupying.
     * 
     * Undefined when the robber has yet to be placed.
     */
    robber?: HexCoordinate;

    /**
     * Retrieves a hex at the specified coordinate, if one exists; otherwise
     * returns `undefined`.
     * 
     * @param coordinate Axial coordinate of the hex to retrieve.
     * @returns The matching hex, or `undefined` if no hex exists there.
     */
    tryGetHex(coordinate: HexCoordinate): Hex | undefined {
        return this.hexes.get(hexId(coordinate));
    }

    /**
     * Checks whether a hex exists at the given coordinate.
     * 
     * @param coordinate Axial coordinate to check.
     * @returns `true` if a hex exists at the given coordinate; otherwise,
     * `false`.
     */
    hasHex(coordinate: HexCoordinate): boolean {
        return this.hexes.has(hexId(coordinate));
    }

    /**
     * Adds a hex to the board and creates graph nodes and edges that don't
     * already exist.
     * 
     * Existing vertices and edges belonging to adjacent hexes are reused so
     * that neighbouring hexes share the same graph nodes and edges.
     * 
     * The added hex is initialzied without a resource, roll, or robber.
     * 
     * @param coordinate Axial coordinate of the hex to add.
     * @returns The newly added hex.
     * @throws Error If a hex already exists at the specified coordinate.
     */
    addHex(coordinate: HexCoordinate): Hex {
        if ( this.hasHex(coordinate) ) {
            throw new Error('A hex already exists at this coordinate');
        }

        const vertices: (NodeId | undefined)[] = new Array(NUM_HEX_DIRECTIONS)
            .fill(undefined)
        let nodeAIndx = 0; // 0th index
        let nodeBIndx = 1; // 1st index
        let neighbourAIndx = 4 // 4th index of neighbor
        let neighbourBIndx = 3 // 3rd index of neighbor

        // getNeighborCoordinates returns them in axial order
        // Assign any existing nodes from adjacent hexes.
        for ( const neighborCoord of getNeighborCoordinates(coordinate) ) {
            const neighborHex = this.tryGetHex(neighborCoord);

            if ( neighborHex ) {
                vertices[nodeAIndx] = neighborHex.vertices[neighbourAIndx];
                vertices[nodeBIndx] = neighborHex.vertices[neighbourBIndx];
            }

            nodeAIndx = nextHexIndx(nodeAIndx);
            nodeBIndx = nextHexIndx(nodeBIndx);
            neighbourAIndx = nextHexIndx(neighbourAIndx);
            neighbourBIndx = nextHexIndx(neighbourBIndx);
        }

        // Create all nodes that don't exist.
        const vertexNodes: NodeId[] = vertices.map(someNode => {
            if ( someNode !== undefined ) return someNode;
            return this.graph.addNode();
        })

        // Create all edges that don't exist.
        const edgeArray = [...vertexNodes, vertexNodes[0]];
        for ( let i = 0; i < NUM_HEX_DIRECTIONS; i++ ) {
            const firstNode = edgeArray[i];
            const secondNode = edgeArray[i + 1];

            if ( !this.graph.hasEdgeBetween(firstNode, secondNode) ) {
                this.graph.addEdge(firstNode, secondNode);
            }
        }

        const hex: Hex = {
            coordinate,
            robber: false,
            vertices: vertexNodes,
        }

        this.hexes.set(hexId(coordinate), hex);
        return hex;
    }

    /**
     * Removes a hex and any orphaned graph nodes or edges.
     * 
     * A vertex is removed when neither of the two neighboring hexes that would
     * share the vertex exist. An edge is removed when one of its vertexes
     * is removed.
     * 
     * @param coordinate Axial coordinate of the hex to remove.
     * @returns The ids of the removed nodes and edges.
     */
    deleteHex(coordinate: HexCoordinate): {
        nodes: NodeId[];
        edges: EdgeId[];
    } {
        const hex = this.hexes.get(hexId(coordinate));

        if ( !hex ) {
            throw new Error(`Hex ${hexId(coordinate)} does not exist`);
        }

        const directions = getNeighborCoordinates(coordinate);
        let dirIndex: number = NUM_HEX_DIRECTIONS - 1;

        const removedNodes: NodeId[] = [];
        const removedEdges: EdgeId[] = [];

        for ( const nodeId of hex.vertices ) {
            if (
                !this.hexes.has(hexId(directions[dirIndex])) &&
                !this.hexes.has(
                    hexId(directions[nextHexIndx(dirIndex)])
                )
            ) { // No hex owns this node
                const edges = this.graph.removeNode(nodeId);
                removedNodes.push(nodeId);
                removedEdges.push(...edges);
            }

            dirIndex = nextHexIndx(dirIndex);
        }

        this.hexes.delete(hexId(coordinate));
        
        return {
            nodes: removedNodes,
            edges: removedEdges,
        }
    }

    /**
     * Sets the resource produced by the hex.
     * 
     * Passing `undefined` removes the hex's resource and turns it into a
     * desert.
     * 
     * @param coordinate Axial coordinate of the target hex.
     * @param resource Resource to assign to the hex, or `undefined` to turn it
     * into a desert.
     * @throws Error If no hex exists at the specifiec coordinate.
     */
    setHexResource(
        coordinate: HexCoordinate,
        resource?: ResourceId
    ): void {
        const hex = this.tryGetHex(coordinate);

        if ( !hex ) {
            throw new Error ('Hex does not exist.');
        }

        hex.resource = resource;
    }

    /**
     * Sets the roll assigned to a hex.
     * 
     * Valid roll values range from 2 through 12, inclusive.
     * 
     * @param coordinate Axial coordinate of the target hex.
     * @param roll Roll to assign to the hex.
     * @throws Error if no hex exists at the given coordinate.
     * @throws Error if the roll is less than 2, greater than 12, or equal to 7
     * @throws Error if the roll is not an integer.
     */
    setHexRoll(
        coordinate: HexCoordinate,
        roll: number
    ): void {
        const hex = this.tryGetHex(coordinate);

        if ( !hex ) {
            throw new Error ('Hex does not exist.');
        }

        if ( !Number.isInteger(roll) || roll < 2 || roll > 12 || roll === 7 ) {
            throw new Error('Invalid roll.');
        }

        hex.roll = roll;
    }

    /**
     * Moves the robber to the specified hex.
     * 
     * If the robber occupies an existing hex, that hex's robber flag is
     * cleared first.
     * 
     * Does nothing if the given coordinate has no corresponding hex.
     * 
     * @param coordinate Axial coordinate of the destination hex.
     */
    moveRobber(coordinate: HexCoordinate): void {
        const hex = this.hexes.get(hexId(coordinate));
        
        if ( !hex ) return;

        if ( this.robber ) {
            const robberHex = this.hexes.get(hexId(this.robber));

            if ( robberHex ) {
                robberHex.robber = false;
            }
        }

        hex.robber = true;
        this.robber = coordinate;
    }

    /**
     * Retrieves the hex at the given coordinate.
     * 
     * @param coordinate Axial coordinate of the hex to retrieve.
     * @returns The hex at the given coordinate.
     * @throws Error if no hex exists at the given coordinate.
     */
    getHex(coordinate: HexCoordinate): Hex {
        const hex = this.hexes.get(hexId(coordinate));
        if ( !hex ) {
            throw new Error(`Hex ${coordinate} does not exist`);
        }

        return hex;
    }

    /**
     * Finds all hexes associated with the specified dice roll.
     * 
     * @param roll Roll value to search for.
     * @returns An array of axial coordinates for hexes matching the given roll.
     */
    getHexesForRoll(roll: number): HexCoordinate[] {
        return [...this.hexes.values()]
            .filter(hex => hex.roll === roll)
            .map(hex => hex.coordinate);
    }

    /**
     * Retrieves all hexes currently on the board.
     * 
     * @returns An array containing every hex on the board.
     */
    getHexes(): Hex[] {
        return [...this.hexes.values()];
    }

    /**
     * Retrievs all nodes in the board's graph.
     * 
     * @returns An array containing every graph node.
     */
    getNodes(): GraphNode[] {
        return [...this.graph.getNodes()];
    }

    /**
     * Retrieves all edges in the board's graph.
     * 
     * @returns An array containing every edge in the graph.
     */
    getEdges(): GraphEdge[] {
        return [...this.graph.getEdges()];
    }

    /**
     * Calculates the resources produced for each player from an array of hex
     * coordinates.
     * 
     * Deserts and hexes occupied by the robber are ignored.
     * 
     * Settlements produce one resource of the hex's type, while cities produce
     * two.
     * 
     * @param coordinates Axial coordinates of the hexes to evaluate.
     * @returns A nested map of player to resource type to quantity. Deserts and
     * the hex with the robber are ignored.
     */
    getResourcesFromHexes(
        coordinates: HexCoordinate[]
    ): Map<Player, Map<ResourceId, number>> {
        const playerResources: Map<Player, Map<ResourceId, number>> = new Map();
        for ( const coordinate of coordinates ) {
            if ( !this.hexes.has(hexId(coordinate)) ) continue;

            const hex = this.getHex(coordinate);
            
            // Ignore deserts and hexes with the robber
            if (
                !hex.resource ||
                hex.robber
            ) {
                continue;
            }

            for ( const nodeId of hex.vertices ) {
                if ( !this.graph.hasNode(nodeId) ) continue;
                const node = this.graph.getNode(nodeId);

                // Ignore nodes a player doesn't own
                if ( !node.player ) continue;

                const resources = playerResources.get(node.player) ?? new Map();

                if ( !playerResources.has(node.player) ) {
                    playerResources.set(node.player, resources);
                }

                let numResources = 0;

                switch ( node.type ) {
                    case 'settlement':
                        numResources = 1;
                        break;
                    case 'city':
                        numResources = 2;
                        break;
                }

                resources.set(
                    hex.resource,
                    (resources.get(hex.resource) ?? 0) + numResources,
                )
            }
        }

        return playerResources;
    }

    /**
     * Calculates the victory point score for every player.
     * 
     * Settlements are worth one point and cities are worth two. The player with
     * largest army or longest road recieves an additional two points.
     * 
     * All players are included, even those with a score of 0.
     * 
     * @returns A record mapping every player to their total score.
     */
    getScores(): Record<Player, number> {
        const scores: Record<Player, number> = {
            'red': 0,
            'blue': 0,
            'white': 0,
            'yellow': 0,
            'green': 0,
            'brown': 0,
        }

        // Count score for largest army
        if ( this.largestArmy ) scores[this.largestArmy] += 2;

        // Count score for longest road
        if ( this.longestRoad ) scores[this.longestRoad] += 2;

        // Count score for each settlement and city
        for ( const node of this.graph.getNodes() ) {
            // Skip nodes without a player
            if ( !node.player ) continue;

            switch ( node.type ) {
                case 'settlement':
                    scores[node.player] += 1;
                    break;
                case 'city':
                    scores[node.player] += 2;
                    break;
            }
        }

        return scores;
    }

    /**
     * Calculates the victory point score for a single player.
     * 
     * Settlements are worth one point and cities are worth two. Holding the
     * largest army or longest road grants an additional two points each.
     * 
     * @param player Player whose score should be calculated.
     * @returns The given player's total victory point score.
     */
    getScore(player: Player): number {
        let score = 0;

        if ( this.largestArmy === player ) score += 2;
        if ( this.longestRoad === player ) score += 2;

        for ( const node of this.graph.getNodes() ) {
            if ( node.player !== player ) continue;

            switch ( node.type ) {
                case 'settlement':
                    score += 1;
                    break;
                case 'city':
                    score += 2;
                    break;
            }
        }

        return score;
    }
}