import type { Player } from "./Hex.js";
import type { Placement } from "./Hex.js";

/**
 * Unique identifier for a graph node.
 */
export type NodeId = string;

/**
 * Unique identifier for a graph edge.
 */
export type EdgeId = string;

/**
 * Represents a node in a graph.
 */
export interface GraphNode {
    id: NodeId;
    player?: Player;
    type?: Placement;
}

/**
 * Represents an edge in a graph.
 */
export interface GraphEdge {
    id: EdgeId;
    from: NodeId;
    to: NodeId;
    road?: Player;
}

/**
 * Represents a graph with nodes and edges.
 * 
 * Nodes and edges are stored and retrieved with an id so as to avoid recursive
 * nesting if they need to serliazed.
 */
export class Graph {
    /**
     * Maps a node id to its corresponding node.
     */
    private nodes: Map<NodeId, GraphNode> = new Map();

    /**
     * Maps an edge id to its correspdoning edge.
     */
    private edges: Map<EdgeId, GraphEdge> = new Map();

    /**
     * Maps a node id to the list of edges to and from its corresponding node.
     * 
     * This graph is treated as undirected, although edges have a `to` and
     * `from`.
     */
    private edgesByNode: Map<NodeId, Set<EdgeId>> = new Map();

    /**
     * Checks whether a node with the given id exists.
     * 
     * @param nodeId Id to check
     * @returns `true` if the graph contains a node with the given id;
     * otherwise `false`.
     */
    hasNode(nodeId: NodeId): boolean {
        return this.nodes.has(nodeId);
    }

    /**
     * Retrieves the node with the given id.
     * 
     * @param nodeId Id of the node to retrieve.
     * @returns The corresponding node.
     * @throws Error if no node with the given id exists.
     */
    getNode(nodeId: NodeId): GraphNode {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        return node;
    }

    /**
     * Adds a node to the graph.
     *
     * @returns Id of the newly created node.
     */
    addNode(): NodeId {
        const id: NodeId = crypto.randomUUID();
        const node: GraphNode = {
            id,
        };

        this.nodes.set(id, node);
        this.edgesByNode.set(id, new Set());

        return id;
    }

    /**
     * Removes a node and any orphaned edges.
     * 
     * @param nodeId Id of the node to remove
     * @returns Array of removed edges.
     */
    removeNode(nodeId: NodeId): EdgeId[] {
        if ( !this.nodes.has(nodeId) ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        const edges = this.edgesByNode.get(nodeId);
        const removedEdges: EdgeId[] = [];

        if ( edges ) {
            for ( const edge of [...edges] ) {
                this.removeEdge(edge);
                removedEdges.push(edge);
            }
        }

        this.nodes.delete(nodeId);
        return removedEdges;
    }

    /**
     * Checks whether an edge with the given id exists.
     * 
     * @param edgeId Id of the edge to check.
     * @returns `true` if the graph contains an edge with the given id;
     * otherwise `false`.
     */
    hasEdge(edgeId: EdgeId): boolean {
        return this.edges.has(edgeId);
    }

    /**
     * Retrieves the edge with the given id.
     * 
     * @param edgeId Id of the edge to retrieve.
     * @returns The corresponding edge.
     * @throws Error if no edge with the given id exists.
     */
    getEdge(edgeId: EdgeId): GraphEdge {
        const edge = this.edges.get(edgeId);

        if ( !edge ) {
            throw new Error(`Edge ${edgeId} does not exist`);
        }

        return edge;
    }

    /**
     * Adds an edge to the graph.
     * 
     * @param from The id of the node this edge comes from.
     * @param to The id of the node this edge goes to.
     * @returns Id of the added edge.
     * @throws Error if either `from` or `to` do not exist.
     */
    addEdge(
        from: NodeId,
        to: NodeId,
    ): EdgeId {
        if ( !this.nodes.has(from) || !this.nodes.has(to) ) {
            throw new Error('Node(s) does not exist');
        }

        const id: EdgeId = crypto.randomUUID();
        const edge: GraphEdge = {
            id,
            from,
            to,
        }

        this.edges.set(id, edge);
        this.edgesByNode.get(from)!.add(id);
        this.edgesByNode.get(to)!.add(id);

        return id;
    }

    /**
     * Removes an edge from the graph.
     * 
     * @param edgeId Id of the edge to remove
     * @throws Error if no edge with the given id exists.
     */
    removeEdge(edgeId: EdgeId): void {
        const edge = this.edges.get(edgeId);

        if ( !edge ) {
            throw new Error(`Edge ${edgeId} does not exist`);
        }

        for ( const nodeId of [edge.to, edge.from] ) {
            const edges = this.edgesByNode.get(nodeId);

            if ( !edges ) continue;

            edges.delete(edgeId);
        }

        this.edges.delete(edgeId);
    }

    /**
     * Retrieves the edge between two nodes if it exists.
     * 
     * @param first Id of one of the nodes to check for.
     * @param second Id of the other node to check for.
     * @returns The edge with `first` and `second` as its `to` and `from`, in
     * either order or `undefined` if no such edge exists.
     */
    tryGetEdgeBetween(
        first: NodeId,
        second: NodeId,
    ): GraphEdge | undefined {
        if (
            !this.nodes.has(first) ||
            !this.nodes.has(second)
        ) {
            return undefined;
        }

        const edges = this.edgesByNode.get(first);

        if ( !edges ) return undefined;

        for ( const edgeId of edges.values() ) {
            const edge = this.edges.get(edgeId);

            if ( !edge ) continue;

            if (
                (
                    first === edge.to &&
                    second === edge.from
                ) ||
                (
                    second === edge.to &&
                    first === edge.from
                )
            ){
                return edge;
            }
        }

        return undefined;
    }

    /**
     * Checks whether an edge exists between two nodes.
     * 
     * @param first Id of one of the nodes to check for.
     * @param second Id of the other node to check for.
     * @returns `true` if an edge exists with both `first` and `second` as either
     * its `to` or `from`; otherwise, `false`.
     */
    hasEdgeBetween(
        first: NodeId,
        second: NodeId,
    ): boolean {
        if (
            !this.nodes.has(first) ||
            !this.nodes.has(second)
        ) {
            return false;
        }

        const edges = this.edgesByNode.get(first);

        if ( !edges ) return false;

        for ( const edgeId of edges.values() ) {
            const edge = this.edges.get(edgeId);

            if ( !edge ) continue;

            if (
                (
                    first === edge.to &&
                    second === edge.from
                ) ||
                (
                    second === edge.to &&
                    first === edge.from
                )
            ){
                return true;
            }
        }

        return false;
    }

    /**
     * Gets every edge to or from a node.
     * 
     * @param nodeId The id of the node to check.
     * @returns An array of every edge with the node with the given id as either
     * its `from` or `to`.
     * @throws Error if no set of edges for the node with the given id exists.
     */
    getConnectedEdges(nodeId: NodeId): GraphEdge[] {
        const edgeIds = this.edgesByNode.get(nodeId);

        if ( !edgeIds ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        return [...edgeIds]
            .map(id => this.edges.get(id)!)
            .filter(Boolean);
    }

    /**
     * Gets every node with an edge between it and another node.
     * 
     * @param nodeId The id of the node to check.
     * @returns An array of every node with an edge between it and the node with
     * the given id.
     */
    getNeighbors(nodeId: NodeId): GraphNode[] {
        return this.getConnectedEdges(nodeId)
            .map(edge => {
                const otherNodeId =
                    edge.from === nodeId
                        ? edge.to
                        : edge.from;
                
                return this.nodes.get(otherNodeId)!;
            });
    }

    /**
     * Sets an edges road to a player.
     * 
     * @param edgeId Id of the edge to modify.
     * @param player Player that owns the road.
     * @throws Error if no edge with the given id exists.
     */
    setRoad(
        edgeId: EdgeId,
        player: Player
    ): void {
        const edge = this.edges.get(edgeId);

        if ( !edge ) {
            throw new Error(`Edge ${edgeId} does not exist`);
        }

        edge.road = player;
    }

    /**
     * Removes an edge.
     * 
     * @param edgeId Id of the edge to remove.
     */
    removeRoad(edgeId: EdgeId): void {
        const edge = this.getEdge(edgeId);
        edge.road = undefined;
    }

    /**
     * Sets a node's type to `settlement` and assigns it to a player.
     * 
     * @param nodeId Id of the node to modify.
     * @param player Player who owns the settlement.
     */
    placeSettlement(
        nodeId: NodeId,
        player: Player
    ): void {
        const node = this.getNode(nodeId);

        node.player = player;
        node.type = 'settlement';
    }

    /**
     * Sets a node's type to 'city' and assigns it to a player.
     * 
     * @param nodeId Id of the node to modify.
     * @param player Player who owns the city.
     */
    placeCity(
        nodeId: NodeId,
        player: Player,
    ): void {
        const node = this.getNode(nodeId);

        node.player = player;
        node.type = 'city';
    }

    /**
     * Sets a node's type to 'city' but doesn't modify its player.
     * 
     * @param nodeId Id of the node to modify.
     * @throws Error if no node with the given id exists.
     * @throws Error if the node's type is already 'city'.
     */
    upgradeToCity(nodeId: NodeId): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        if ( node.type !== 'settlement' ) {
            throw new Error('Only settlements can be upgraded to cities');
        }

        node.type = 'city';
    }

    /**
     * Sets a node's type to 'settlement' but doesn't modify its player.
     * 
     * @param nodeId Id of the node to modify.
     * @throws Error if no node with the given id exists.
     * @throws Error if the node's type is already 'settlement'
     */
    downgradeToSettlement(nodeId: NodeId): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        if ( node.type !== 'city' ) {
            throw new Error('Only cities can be downgraded to settlements');
        }

        node.type = 'settlement';
    }

    /**
     * Assigns a player to a node.
     * 
     * @param nodeId Id of the node to modify.`
     * @param player THe owner of the settlement or city.
     * @throws Error if no node with the given id exists.
     * @throws Error if the node's type is `undefined`.
     */
    setPlayer(
        nodeId: NodeId,
        player: Player
    ): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        if ( node.type === undefined ) {
            throw new Error('Player cannot own empty node');
        }

        node.player = player;
    }

    /**
     * Sets a node's type and player to `undefined`.
     * 
     * @param nodeId Id of the node to modify.
     */
    removePlacement(nodeId: NodeId): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        node.type = undefined;
        node.player = undefined;
    }

    /**
     * Finds the longest road for a player.
     * 
     * @param player Player to find longest road for.
     * @returns Array of edges that comprise the given player's longest
     * road.
     */
    findLongestRoad(player: Player): EdgeId[] {
        let longest: EdgeId[] = [];

        for ( const nodeId of this.nodes.keys() ) {
            const roadEdges = this.findLongestRoadFromNode(
                nodeId,
                player,
                new Set(),
            );

            if ( roadEdges.length > longest.length ) {
                longest = roadEdges;
            }
        }

        return longest;
    }

    /**
     * 
     * @param nodeId Id of the node to find longest road from.
     * @param player Player to check for.
     * @param usedEdges Array of edges already visited.
     * @returns Array of edges that comprise the given player's longest road
     * starting from the node with the given id.
     * @throws Error if no node with the given id exists.
     */
    private findLongestRoadFromNode(
        nodeId: NodeId,
        player: Player,
        usedEdges: Set<EdgeId>,
    ): EdgeId[] {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist.`);
        }

        if (
            node.player !== undefined &&
            node.player !== player
        ) {
            return [];
        }

        let longest: EdgeId[] = [];

        for ( const edge of this.getConnectedEdges(nodeId) ) {
            if (
                edge.road !== player ||
                usedEdges.has(edge.id)
            ) {
                continue;
            }
            
            usedEdges.add(edge.id);

            const nextNodeId =
                edge.from === nodeId
                    ? edge.to
                    : edge.from;
            
            const roadEdges = [
                edge.id,
                ...this.findLongestRoadFromNode(
                    nextNodeId,
                    player,
                    usedEdges,
                ),
            ]
            
            usedEdges.delete(edge.id);

            if ( roadEdges.length > longest.length ) {
                longest = roadEdges;
            }
        }

        return longest;
    }

    /**
     * Gets every node in the graph.
     * 
     * @returns Array of every node in the graph.
     */
    getNodes(): GraphNode[] {
        return [...this.nodes.values()];
    }

    /**
     * Gets every edge in the graph.
     * 
     * @returns Array of every edge in the graph.
     */
    getEdges(): GraphEdge[] {
        return [...this.edges.values()];
    }

    /**
     * Gets the longset road for each player.
     * 
     * @returns Array of objects with each player and the edges that comprise
     * their longest road.
     */
    getPlayersWithLongestRoad(): { player: Player, roadEdges: EdgeId[] }[] {
        const playerList: { player: Player, roadEdges: EdgeId[] }[] = [
            { player: 'red', roadEdges: this.findLongestRoad('red') },
            { player: 'blue', roadEdges: this.findLongestRoad('blue') },
            { player: 'white', roadEdges: this.findLongestRoad('white') },
            { player: 'yellow', roadEdges: this.findLongestRoad('yellow') },
            { player: 'green', roadEdges: this.findLongestRoad('green') },
            { player: 'brown', roadEdges: this.findLongestRoad('brown') },
        ]

        const roadMap: Map<number, { player: Player, roadEdges: EdgeId[] }[]> = new Map();
        let longestFound: number = 0;

        for ( const playerData of playerList ) {
            const currentMap = roadMap.get(playerData.roadEdges.length);
            
            if ( !currentMap ) {
                roadMap.set(playerData.roadEdges.length, [playerData]);
            } else {
                currentMap.push(playerData);
            }

            if ( playerData.roadEdges.length > longestFound ) {
                longestFound = playerData.roadEdges.length;
            }
        }

        return roadMap.get(longestFound) ?? [];
    }
}