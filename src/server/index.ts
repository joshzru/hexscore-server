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

const board = new Board();

const server = createServer(app);
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
    >(server);

io.on('connect', (socket) => {
    socket.on('hex:create', (coordinate) => {
        if ( board.hasHex(coordinate) ) return;
        board.addHex(coordinate);
        io.emit('hex:created', coordinate);
    });

    socket.on('hex:delete', (coordinate) => {
        if ( !board.hasHex(coordinate) ) return;
        board.deleteHex(coordinate);
        io.emit('hex:deleted', coordinate);
    });

    socket.on('hex:setresource', (coordinate, resource) => {
        if ( !board.hasHex(coordinate) ) return;
        board.setHexResource(coordinate, resource);
        // TODO: Setup emit for changing resource.
    })

    socket.on('hex:setroll', (coordinate, roll) => {
        if ( !board.hasHex(coordinate) ) return;
        board.setHexRoll(coordinate, roll);
        // TODO: setup emit for changing roll.
    })

    socket.on('dice:result', result => {
        // TODO: setup emit for a roll.
    });

    socket.emit('init', board.getState());
})

server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
})