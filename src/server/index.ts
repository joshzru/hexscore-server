import { createServer } from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import config from './config.js';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
} from './socket.js';
import { Board } from './state/Board.js';
import { HexCoordinate } from './state/Hex.js';
import {
    EdgeId,
    GraphEdge
} from './state/Graph.js';

const board = new Board();

const server = createServer(app);
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
    >(server);

io.on('connect', (socket) => {
    console.log('User connected');

    socket.on('hex:create', (coordinate) => {
        // TODO: Modify addHex to just return the added nodes and edges.
        if ( board.hasHex(coordinate) ) return;
        const hex = board.addHex(coordinate);
        const nodes = hex.vertices.map(nodeId => board.graph.getNode(nodeId));
        
        // Get all edges between this hexes nodes
        const edges: GraphEdge[] = [];
        const nodeIds = [...hex.vertices, hex.vertices[0]];
        for ( let i = 0; i < hex.vertices.length; i++ ) {
            const first = nodeIds[i];
            const second = nodeIds[i + 1];

            const edge = board.graph.tryGetEdgeBetween(first, second);

            if ( !edge ) continue;

            edges.push(edge);
        }

        io.emit(
            'hex:created',
            hex,
            nodes,
            edges,
        );
    });

    socket.on('hex:createarea', (center, radius) => {
        radius = Math.abs(Math.round(radius));
        const added = board.addArea(center, radius);

        for ( const coordinate of added ) {
            const hex = board.getHex(coordinate);
            const nodes = hex.vertices.map(nodeId => board.graph.getNode(nodeId));

            const edges: GraphEdge[] = [];
            const nodeIds = [...hex.vertices, hex.vertices[0]];
            for ( let i = 0; i < hex.vertices.length; i++ ) {
                const first = nodeIds[i];
                const second = nodeIds[i + 1];

                const edge = board.graph.tryGetEdgeBetween(first, second);

                if ( !edge ) continue;

                edges.push(edge);
            }

            io.emit(
                'hex:created',
                hex,
                nodes,
                edges,
            )
        }
    })

    socket.on('hex:delete', (coordinate) => {
        if ( !board.hasHex(coordinate) ) return;
        const { nodes, edges } = board.deleteHex(coordinate);
        io.emit(
            'hex:deleted',
            coordinate,
            nodes,
            edges,
        );
    });

    socket.on('hex:setresource', (coordinate, resource) => {
        if ( !board.hasHex(coordinate) ) return;
        board.setHexResource(coordinate, resource);
        io.emit(
            'hex:setresource',
            coordinate,
            resource,
        );
    });

    socket.on('hex:setroll', (coordinate, roll) => {
        if ( !board.hasHex(coordinate) ) return;

        board.setHexRoll(coordinate, roll);
        
        io.emit(
            'hex:setroll',
            coordinate,
            roll,
        );
    });

    socket.on('hex:moverobber', coordinate => {
        if ( !board.hasHex(coordinate) ) return;

        let from: HexCoordinate | undefined = undefined;

        if (
            board.robber &&
            board.hasHex(board.robber)
        ) {
            from = board.robber;
        }

        board.moveRobber(coordinate);

        io.emit(
            'hex:movedrobber',
            from,
            coordinate,
        );
    });

    socket.on('node:placesettlement', (nodeId, player) => {
        if ( !board.graph.hasNode(nodeId) ) return;
        board.graph.placeSettlement(nodeId, player);

        io.emit(
            'node:placedsettlement',
            nodeId,
            player,
        );
        io.emit(
            'score:update',
            player,
            board.getScore(player),
        );
    });

    socket.on('node:placecity', (nodeId, player) => {
        if ( !board.graph.hasNode(nodeId) ) return;
        board.graph.placeCity(nodeId, player);

        io.emit(
            'node:placedcity',
            nodeId,
            player,
        );
        io.emit(
            'score:update',
            player,
            board.getScore(player),
        );
    });

    socket.on('node:upgrade', nodeId => {
        if ( !board.graph.hasNode(nodeId) ) return;
        board.graph.upgradeToCity(nodeId);

        const node = board.graph.getNode(nodeId);
        io.emit(
            'node:placedcity',
            nodeId,
            node.player!,
        );

        if ( !node.player ) return;

        io.emit(
            'score:update',
            node.player,
            board.getScore(node.player),
        )
    });

    socket.on('node:downgrade', nodeId => {
        if ( !board.graph.hasNode(nodeId) ) return;
        board.graph.downgradeToSettlement(nodeId);

        const node = board.graph.getNode(nodeId);
        io.emit(
            'node:placedsettlement',
            nodeId,
            node.player!,
        );

        if ( !node.player ) return;

        io.emit(
            'score:update',
            node.player,
            board.getScore(node.player),
        )
    });

    socket.on('node:removeplacement', nodeId => {
        if ( !board.graph.hasNode(nodeId) ) return;
        const player = board.graph.getNode(nodeId).player
        board.graph.removePlacement(nodeId);

        io.emit(
            'node:removedplacement',
            nodeId,
        );

        if ( !player ) return;

        io.emit(
            'score:update',
            player,
            board.getScore(player),
        )
    });

    socket.on('node:setplayer', (nodeId, player) => {
        if ( !board.graph.hasNode(nodeId) ) return;
        const prevPlayer = board.graph.getNode(nodeId).player;
        board.graph.setPlayer(nodeId, player);

        io.emit(
            'node:changedplayer',
            nodeId,
            player,
        );
        io.emit(
            'score:update',
            player,
            board.getScore(player),
        );

        if ( !prevPlayer ) return;

        io.emit(
            'score:update',
            prevPlayer,
            board.getScore(prevPlayer),
        )
    });

    socket.on('edge:placeroad', (edgeId, player) => {
        if ( !board.graph.hasEdge(edgeId) ) return;
        board.graph.setRoad(edgeId, player);

        io.emit(
            'edge:placedroad',
            edgeId,
            player,
        );
    });

    socket.on('edge:removeroad', edgeId => {
        if ( !board.graph.hasEdge(edgeId) ) return;
        board.graph.removeRoad(edgeId);

        io.emit(
            'edge:removedroad',
            edgeId,
        );
    });

    socket.on('edge:setplayer', (edgeId, player) => {
        if ( !board.graph.hasEdge(edgeId) ) return;
        board.graph.setRoad(edgeId, player);

        io.emit(
            'edge:changedplayer',
            edgeId,
            player,
        );
    })

    socket.on('dice:result', roll => {
        const coordinates = board.getHexesForRoll(roll);
        const playerResources = board.getResourcesFromHexes(coordinates);

        const edges: EdgeId[] = [];
        for ( const coordinate of coordinates) {
            const hex = board.getHex(coordinate);
            const nodeIds = [...hex.vertices, hex.vertices[0]];
            for ( let i = 0; i < hex.vertices.length; i++ ) {
                const edge = board.graph.tryGetEdgeBetween(
                    nodeIds[i],
                    nodeIds[i + 1],
                );

                if ( !edge ) continue;

                edges.push(edge.id);
            }
        }

        io.emit(
            'dice:resources',
            coordinates,
            edges,
            Array.from( // Convert map to array to get around socket.io being cringe
                playerResources,
                ([player, resources]) => [
                    player,
                    Array.from(resources.entries()),
                ]
            )
        );
    });

    socket.on('recover:state', () => {
        socket.emit(
            'init',
            board.getHexes(),
            board.getNodes(),
            board.getEdges(),
            board.getScores(),
        )
    });

    socket.on('score:assignlongestroad', player => {
        if ( board.longestRoad === player ) return;

        const prevPlayer = board.longestRoad;
        board.longestRoad = player;

        io.emit(
            'score:update',
            player,
            board.getScore(player),
        );

        if ( !prevPlayer ) return;

        io.emit(
            'score:update',
            prevPlayer,
            board.getScore(prevPlayer),
        );
    });

    socket.on('score:assignlargestarmy', player => {
        if ( board.largestArmy === player ) return;

        const prevPlayer = board.largestArmy;
        board.largestArmy = player;

        io.emit(
            'score:update',
            player,
            board.getScore(player),
        )

        if ( !prevPlayer ) return;

        io.emit(
            'score:update',
            prevPlayer,
            board.getScore(prevPlayer),
        )
    });

    socket.on('score:findlongestroad', () => {
        const longest = board.graph.getPlayersWithLongestRoad();
        const edges: EdgeId[] = [];

        for ( const road of longest ) {
            edges.push(...road.roadEdges);
        }

        io.emit(
            'edge:highlight',
            edges,
        )
    })

    socket.emit(
        'init',
        board.getHexes(),
        board.getNodes(),
        board.getEdges(),
        board.getScores(),
    );
})

server.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`);
})