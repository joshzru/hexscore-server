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

const server = createServer();
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
    >(server);

server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
})