import { Hex, HexCoordinate, ResourceId } from "./state/Hex.js";

export interface ServerToClientEvents {
    init: (hexes: Hex[]) => void;
    'hex:created': (coordinate: HexCoordinate) => void;
    'hex:deleted': (coordinate: HexCoordinate) => void;
    'hex:modified': (hex: Hex) => void;
};

export interface ClientToServerEvents {
    'hex:create': (coordinate: HexCoordinate) => void;
    'hex:delete': (coordinate: HexCoordinate) => void;
    'hex:setresource': (
        coordinate: HexCoordinate,
        resource: ResourceId,
    ) => void;
    'hex:setroll': (
        coordinate: HexCoordinate,
        roll: number,
    ) => void;
    'dice:result': (result: number) => void;
};

export interface InterServerEvents {
    ping: () => void;
};

export interface SocketData {

};