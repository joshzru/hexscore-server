
export interface ServerToClientEvents {
    init: () => void;
    gameNotAvailable: () => void;
    invalidAction: () => void;
    lobbyFull: () => void;
};

export interface ClientToServerEvents {

};

export interface InterServerEvents {
    ping: () => void;
};

export interface SocketData {

};