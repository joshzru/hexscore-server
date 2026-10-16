import type {
    EdgeId,
    GraphEdge,
    GraphNode,
    NodeId
} from "./state/Graph.js";
import type {
    Hex,
    HexCoordinate,
    Player,
    ResourceId
} from "./state/Hex.js";

/**
 * Represents the events the server can emit to its clients.
 * 
 * 'init': Communicates the entire game state.
 * 
 * 'hex:created': Communicates a created hex and its associated nodes and
 * edges, even those that already exists.
 * 
 * 'hex:deleted': Communicates a deleted hex and its associated nodes and
 * edges that were also deleted.
 * 
 * 'hex:setresource': Communicates that a hex's resource was set.
 * 
 * 'hex:setroll': Communicates that a hex's roll was set.
 * 
 * 'hex:movedrobber': Communciates that the robber was moved, the hex it was
 * moved from and the hex it moved to.
 * 
 * 'node:placedsettlement': Communicates that a settlement was placed.
 * 
 * 'node:placedcity': Communicates that a city was placed.
 * 
 * 'node:removedplacement': Communicates that a settlement/city was removed.
 * 
 * 'node:changedplayer': Communicates that a node's player was changed.
 * 
 * 'edge:placedroad': Communciates that a player's road was placed.
 * 
 * 'edge:removedroad': Communicates that a road was removed.
 * 
 * 'edge:changedplaeyr': Communicates that a road's player was changed.
 * 
 * 'edge:highlight': Communicates the edges that should be highlighted. Used
 * for highlighting longest road.
 * 
 * 'dice:resources': Communicates the hexes that produced resources, the edges
 * of those hexes, and a flattened, nested map of players to resource ids to
 * the quantity of that resource.
 * 
 * 'score:update': Communicates that a player's score was updated.
 * 
 */
export interface ServerToClientEvents {
    /**
     * Communciates the entire game state.
     * 
     * @param hexes Array containing each hex on the board.
     * @param nodes Array containing each node in the board's underlying graph.
     * @param edges Array containing each edge in the board's underlying graph.
     * @param scores Record of each player's score.
     */
    init: (
        hexes: Hex[],
        nodes: GraphNode[],
        edges: GraphEdge[],
        scores: Record<Player, number>
        ) => void;
    'hex:created': (
        hex: Hex,
        nodes: GraphNode[],
        edges: GraphEdge[]
    ) => void;
    'hex:deleted': (
        coordinate: HexCoordinate,
        nodes: NodeId[],
        edges: EdgeId[],
    ) => void;
    'hex:setresource': (
        coordinate: HexCoordinate,
        resource?: ResourceId,
    ) => void;
    'hex:setroll': (
        coordinate: HexCoordinate,
        roll: number,
    ) => void;
    'hex:movedrobber': (
        from: HexCoordinate | undefined,
        to: HexCoordinate,
    ) => void;
    'node:placedsettlement': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'node:placedcity': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'node:removedplacement': (nodeId: NodeId) => void;
    'node:changedplayer': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'edge:placedroad': (
        edgeId: EdgeId,
        player: Player,
    ) => void;
    'edge:removedroad': (edgeId: EdgeId) => void;
    'edge:changedplayer': (
        edgeId: EdgeId,
        player: Player,
    ) => void;
    'edge:highlight': (edges: EdgeId[]) => void;
    'dice:resources': (
        coordinates: HexCoordinate[],
        edges: EdgeId[],
        playerResources: (Player | [ResourceId, number][])[][],
    ) => void;
    'score:update': (
        player: Player,
        score: number,
    ) => void;
};

/**
 * Represents the events a client can emit to the server.
 * 
 * 'hex:create': Communicates that a hex should be created at a coordinate.
 * 
 * 'hex:createarea': Communicates that any non-existance hex in the given 
 * radius from the given center should be created.
 * 
 * 'hex:delete': Communicates that a hex should be deleted at a coordinate.
 * 
 * 'hex:setresource': Communicates that a hex's resource should be set at a
 * coordinate.
 * 
 * 'hex:setroll': Communicates that a hex's roll should be set at a
 * coordinate.
 * 
 * 'hex:moverobber': Communicates that the robber should be moved to a
 * coordinate.
 * 
 * 'node:placesettlement': Communicates that a player's settlement should be
 * placed at a node.
 * 
 * 'node:placecity': Communicates that a player's city should be placed at a
 * node.
 * 
 * 'node:upgrade': Communicates that a node should be upgraded from a
 * settlement to a city.
 * 
 * 'node:downgrade': Communicates that a node should be downgraded from a city
 * to a settlement.
 * 
 * 'node:removeplacement': Communicates that a settlement/city should be
 * removed from a node.
 * 
 * 'node:setplayer': Communicates that a node's settlement/city should
 * be set to a player.
 * 
 * 'edge:placeroad': Communicates that a player's road should be placed on an
 * edge.
 * 
 * 'edge:removeroad': Communicates that a road should be removed from an edge.
 * 
 * 'edge:setplayer': Communicates that an edge's road should be set to a
 * player.
 * 
 * 'dice:result': Communicates that the dice have been rolled.
 * 
 * 'recover:state': Communicates that the entire game state needs to be
 * recovered for the client who sent it.
 * 
 * 'score:assignlongestroad': Communicates that the longest road should be
 * assigned to a player.
 * 
 * 'score:assignlargestarmy': Communicates that the largest army should be
 * assigned to a player.
 * 
 * 'score:findlongestroad': Communicates that the longest road or roads tied
 * for the longest should be highlighted.
 */
export interface ClientToServerEvents {
    'hex:create': (coordinate: HexCoordinate) => void;
    'hex:createarea': (
        center: HexCoordinate,
        radius: number,
    ) => void;
    'hex:delete': (coordinate: HexCoordinate) => void;
    'hex:setresource': (
        coordinate: HexCoordinate,
        resource: ResourceId | undefined,
    ) => void;
    'hex:setroll': (
        coordinate: HexCoordinate,
        roll: number,
    ) => void;
    'hex:moverobber': (coordinate: HexCoordinate) => void;
    'node:placesettlement': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'node:placecity': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'node:upgrade': (nodeId: NodeId) => void;
    'node:downgrade': (nodeId: NodeId) => void;
    'node:removeplacement': (nodeId: NodeId) => void;
    'node:setplayer': (
        nodeId: NodeId,
        player: Player,
    ) => void;
    'edge:placeroad': (
        edgeId: EdgeId,
        player: Player,
    ) => void;
    'edge:removeroad': (edgeId: EdgeId) => void;
    'edge:setplayer': (
        edgeId: EdgeId,
        player: Player,
    ) => void;
    'dice:result': (roll: number) => void;
    'recover:state': () => void;
    'score:assignlongestroad': (player: Player) => void;
    'score:assignlargestarmy': (player: Player) => void;
    'score:findlongestroad': () => void;
};

/**
 * Represents the events the server can emit to itself.
 */
export interface InterServerEvents {
    ping: () => void;
};

/**
 * Represents the data attached to a socket.
 */
export interface SocketData {

};