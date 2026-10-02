import type { Player } from "./Hex.js";
import type { Placement } from "./Hex.js";

type NodeId = string;
type EdgeId = string;

interface Node {
    id: NodeId;
    player?: Player;
    type?: Placement;
}

export interface Edge {
    id: EdgeId;
    from: NodeId;
    to: NodeId;
    road?: Player;
}

export class Graph {
    private nodes: Map<NodeId, Node> = new Map();
    private edges: Map<EdgeId, Edge> = new Map();
    private edgesByNode: Map<NodeId, Set<EdgeId>> = new Map();

    addNode(): NodeId {
        const id: NodeId = crypto.randomUUID();
        const node: Node = {
            id,
        };

        this.nodes.set(id, node);
        this.edgesByNode.set(id, new Set());

        return id;
    }

    addEdge(
        from: NodeId,
        to: NodeId,
    ): EdgeId {
        const fromNode = this.nodes.get(from);
        const toNode = this.nodes.get(to);

        if ( !this.nodes.has(from) || !this.nodes.has(to) ) {
            throw new Error('Node(s) does not exist');
        }

        const id: EdgeId = crypto.randomUUID();
        const edge: Edge = {
            id,
            from,
            to,
        }

        this.edges.set(id, edge);
        this.edgesByNode.get(from)!.add(id);
        this.edgesByNode.get(to)!.add(id);

        return id;
    }

    getConnectedEdges(nodeId: NodeId): Edge[] {
        const edgeIds = this.edgesByNode.get(nodeId);

        if ( !edgeIds ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        return [...edgeIds]
            .map(id => this.edges.get(id)!)
            .filter(Boolean);
    }

    getNeighbors(nodeId: NodeId): Node[] {
        return this.getConnectedEdges(nodeId)
            .map(edge => {
                const otherNodeId =
                    edge.from === nodeId
                        ? edge.to
                        : edge.from;
                
                return this.nodes.get(otherNodeId)!;
            });
    }

    setRoad(
        edgeId: EdgeId,
        player: Player
    ): void {
        const edge = this.edges.get(edgeId);

        if ( !edge ) {
            throw new Error(`Edge ${edgeId} does not exist`);
        }

        if ( edge.road !== undefined ) {
            throw new Error('This edge already contains a road');
        }

        edge.road = player;
    }

    placeSettlement(
        nodeId: NodeId,
        player: Player
    ): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        if ( node.type !== undefined ) {
            throw new Error('This node is already occupied');
        }

        node.player = player;
        node.type = 'settlement';
    }

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

        if ( node.player === player ) {
            throw new Error(`Player ${player} already owns this node`)
        }

        node.player = player;
    }

    removePlacement(nodeId: NodeId): void {
        const node = this.nodes.get(nodeId);

        if ( !node ) {
            throw new Error(`Node ${nodeId} does not exist`);
        }

        node.type = undefined;
        node.player = undefined;
    }
}