/**
 * Not writing docstrings for this at the moment since I'll be rewriting a
 * majority of it, probably.
 * 
 * Too much user friction, need fewer buttons and easier confirmation.
 * 
 * Creating new hexes is too easy and can be done accidentally when trying to
 * select an edge or node at the edge of a map.
 * 
 * Placing settlements, cities, roads, and changing player assignments requires
 * several button presses for each action.
 * 
 * Assigning resources and rolls to hexes also requires several button presses
 * for each action.
 * 
 * The robber prevents a user from selecting the hex it is on, you have to
 * click around it.
 * 
 * No way to lock current board rotation or lock the board so that no new hexes
 * can be created or removed.
 * 
 * Highlighting hexes, edges, and nodes is broken, need to rework.
*/
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
    Hex,
    HexId,
    HexCoordinate,
    ResourceId,
    Player
} from '../server/state/Hex.js';
import type {
    GraphEdge,
    GraphNode,
    NodeId,
    EdgeId,
} from '../server/state/Graph.js';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from '../server/socket.js';

type PointerState = 'default' | 'down' | 'dragging' | 'area-select';

type Gesture = {
    evCache: Map<number, PointerEvent>;
    pinchDistance: number | null;
    lastAngle: number | null;
}

type DragPointer = {
    state: PointerState;
    id?: number;
    startPoint?: Point;
    lastPoint?: Point;
    downTargets: Map<number, EventTarget | null>;
    singleClickTimeout?: number;
    doubleClickDetected: boolean;
    lastClick: {
        time: number;
        x: number;
        y: number;
        target: EventTarget | null;
    }
}

type Selection = {
    el?: SVGElement;
}

type DialogType =
    | 'assign-roll'
    | 'assign-resource'
    | 'place-road'
    | 'place-settlement'
    | 'place-city'
    | 'change-player'
    | 'roll-dice'
    | 'assign-longest-road'
    | 'assign-largest-army';

const EPSILON: number = 1e-4;
const CLICK_DELAY: number = 200;
const CLICK_DISTANCE: number = 5;

class SelectionDialog {
    dialog: HTMLDialogElement;
    form: HTMLFormElement;
    title: HTMLHeadingElement;
    inputs: {
        player: HTMLSelectElement;
        resource: HTMLSelectElement;
        roll: HTMLInputElement;
    }
    labels: {
        playerLabel: HTMLLabelElement;
        resourceLabel: HTMLLabelElement;
        rollLabel: HTMLLabelElement;
    }
    actions: {
        confirm: HTMLButtonElement;
        cancel: HTMLButtonElement;
    }
    type?: DialogType;
    target?: SVGElement | null;

    constructor() {
        const dialog = document
            .querySelector<HTMLDialogElement>('#selection-dialog');
        
        if ( !dialog ) {
            throw new Error("Selection dialog not found");
        }

        const form = dialog.querySelector<HTMLFormElement>('form');
        const title = dialog.querySelector<HTMLHeadingElement>('h2');
        const player = dialog.querySelector<HTMLSelectElement>('#player-choice');
        const playerLabel = player?.closest('label');
        const resource = dialog.querySelector<HTMLSelectElement>('#resource-choice');
        const resourceLabel = resource?.closest('label');
        const roll = dialog.querySelector<HTMLInputElement>('#roll-input');
        const rollLabel = roll?.closest('label');
        const confirm = dialog.querySelector<HTMLButtonElement>('button[value="confirm"]');
        const cancel = dialog.querySelector<HTMLButtonElement>('button[value="cancel"]');

        if (
            !form ||
            !title ||
            !player ||
            !playerLabel ||
            !resource ||
            !resourceLabel ||
            !roll ||
            !rollLabel ||
            !confirm ||
            !cancel
        ) {
            throw new Error("Selection dialog has an invalid structure")
        }

        this.dialog = dialog;
        this.form = form;
        this.title = title;
        this.inputs = {
            player,
            resource,
            roll,
        }
        this.labels = {
            playerLabel,
            resourceLabel,
            rollLabel,
        }
        this.actions = {
            confirm,
            cancel,
        }

        this.actions.confirm.addEventListener('click', () => this.handleConfirm());
        this.actions.cancel.addEventListener('click', () => this.handleCancel());
    }

    open(title: string): void {
        // Don't open unless we have a target
        if ( this.target === undefined ) return;
        this.title.textContent = title;
        this.dialog.showModal();
    }

    choosePlayer(target: SVGElement | null): this {
        return this
            .setTarget(target)
            .setPlayerHidden(false)
            .setResourceHidden(true)
            .setRollHidden(true);
    }

    chooseResource(target: SVGElement | null): this {
        return this
            .setTarget(target)
            .setPlayerHidden(true)
            .setResourceHidden(false)
            .setRollHidden(true);
    }

    chooseRoll(target: SVGElement | null): this {
        return this
            .setTarget(target)
            .setPlayerHidden(true)
            .setResourceHidden(true)
            .setRollHidden(false);
    }

    setPlayerHidden(hidden: boolean): this {
        this.labels.playerLabel.hidden = hidden;
        return this;
    }

    setResourceHidden(hidden: boolean): this {
        this.labels.resourceLabel.hidden = hidden;
        return this;
    }

    setRollHidden(hidden: boolean): this {
        this.labels.rollLabel.hidden = hidden;
        return this;
    }

    setType(type?: DialogType): this {
        this.type = type;
        return this;
    }

    setTarget(target?: SVGElement | null): this {
        this.target = target;
        return this;
    }

    handleConfirm(): void{
        if ( this.target === undefined ) {
            this.dialog.close();
            return;
        }
        
        // Handle null targets
        switch ( this.type ) {
            case 'roll-dice':
                if ( !isDiceRoll(this.inputs.roll.value) ) {
                    this.dialog.close;
                    break;
                }

                socket.emit(
                    'dice:result',
                    Number(this.inputs.roll.value),
                )
                break;
            case 'assign-longest-road':
                if ( !isPlayer(this.inputs.player.value) ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'score:assignlongestroad',
                    this.inputs.player.value,
                )
                break;
            case 'assign-largest-army':
                if ( !isPlayer(this.inputs.player.value) ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'score:assignlargestarmy',
                    this.inputs.player.value,
                )
                break;
        }

        if ( this.target === null ) {
            this.dialog.close();
            return;
        }

        // Handle non-null targets
        switch ( this.type ) {
            case 'assign-resource':
                if (
                    !this.target.dataset.hexId ||
                    !isCoordinate(this.target.dataset.hexId)
                ) {
                    this.dialog.close();
                    break;
                }

                const resource = isResource(this.inputs.resource.value)
                    ? this.inputs.resource.value
                    : undefined;

                socket.emit(
                    'hex:setresource',
                    coordinateFromId(this.target.dataset.hexId),
                    resource,
                )

                this.dialog.close();
                break;
            case 'assign-roll':
                if (
                    !this.target.dataset.hexId ||
                    !isCoordinate(this.target.dataset.hexId)
                ) {
                    this.dialog.close();
                    break;
                }

                if ( !isDiceRoll(this.inputs.roll.value) ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'hex:setroll',
                    coordinateFromId(this.target.dataset.hexId),
                    Number(this.inputs.roll.value),
                )

                this.dialog.close();
                break;
            case 'place-settlement':
                if (
                    !this.target.dataset.nodeId ||
                    !isPlayer(this.inputs.player.value)
                ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'node:placesettlement',
                    this.target.dataset.nodeId,
                    this.inputs.player.value,
                )

                this.dialog.close();
                break;
            case 'place-city':
                if (
                    !this.target.dataset.nodeId ||
                    !isPlayer(this.inputs.player.value)
                ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'node:placecity',
                    this.target.dataset.nodeId,
                    this.inputs.player.value,
                )

                this.dialog.close();
                break;
            case 'place-road':
                if (
                    !this.target.dataset.edgeId ||
                    !isPlayer(this.inputs.player.value)
                ) {
                    this.dialog.close();
                    break;
                }

                socket.emit(
                    'edge:placeroad',
                    this.target.dataset.edgeId,
                    this.inputs.player.value,
                )

                this.dialog.close();
                break;
            case 'change-player':
                if (
                    this.target.dataset.type === 'node' &&
                    this.target.dataset.nodeId &&
                    isPlayer(this.inputs.player.value)
                ) {
                    socket.emit(
                        'node:setplayer',
                        this.target.dataset.nodeId,
                        this.inputs.player.value,
                    )
                }

                if (
                    this.target.dataset.type === 'edge' &&
                    this.target.dataset.edgeId &&
                    isPlayer(this.inputs.player.value)
                ) {
                    socket.emit(
                        'edge:setplayer',
                        this.target.dataset.edgeId,
                        this.inputs.player.value,
                    )
                }

                this.dialog.close();
                break;
            case undefined:
                this.dialog.close();
                break;
        }
    }

    handleCancel(): void {
        this.type = undefined;
        this.target = undefined;
        this.dialog.close();
    }
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

const hexMap: Map<HexId, Hex> = new Map();
const nodeMap: Map<NodeId, GraphNode> = new Map();
const edgeMap: Map<EdgeId, GraphEdge> = new Map();

const svg = document.querySelector<SVGSVGElement>('svg')!;

const hexGrid = {
    hexes: document.querySelector<SVGGElement>('#hexes')!,
    edges: document.querySelector<SVGGElement>('#edges')!,
    nodes: document.querySelector<SVGGElement>('#nodes')!,
};

const playerScores: Record<Player, HTMLDivElement> = {
    red: document.querySelector<HTMLDivElement>('div#player-red')!,
    blue: document.querySelector<HTMLDivElement>('div#player-blue')!,
    white: document.querySelector<HTMLDivElement>('div#player-white')!,
    yellow: document.querySelector<HTMLDivElement>('div#player-yellow')!,
    green: document.querySelector<HTMLDivElement>('div#player-green')!,
    brown: document.querySelector<HTMLDivElement>('div#player-brown')!,
}

const cameraElement = document.querySelector<SVGElement>('#camera')!;
let animationFrame: number | null = null;

svg.addEventListener('dragstart', e => e.preventDefault());


// Set { q: 0, r: 0 } to be at the center of the screen
const camera = {
    currentX: window.innerWidth / 2,
    currentY: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    currentScale: 1,
    targetScale: 1,
    currentRotation: 0,
    targetRotation: 0,
}
cameraElement.setAttribute(
    'transform',
    `translate(${camera.currentX},${camera.currentY})
    scale(${camera.currentScale},${camera.currentScale})
    rotate(${camera.currentRotation * 180 / Math.PI})`,
)

type AreaSelectData = {
    center?: HexCoordinate;
    radius?: number;
}

const virtualAreaHexes: Set<HexId> = new Set();
const highlightedArea: Set<HexId> = new Set();
const areaSelect: AreaSelectData = {};

const pointer: DragPointer = {
    state: 'default',
    downTargets: new Map(),
    doubleClickDetected: false,
    lastClick: {
        time: 0,
        x: 0,
        y: 0,
        target: null,
    },
}

const gesture: Gesture = {
    evCache: new Map(),
    pinchDistance: null,
    lastAngle: null,
}

const selection: Selection = {
    
}

const dialog = new SelectionDialog();

function panCamera(
    x: number,
    y: number,
): void {
    camera.targetX += x;
    camera.targetY += y;
    scheduleCameraAnimation();
}

const followStrength = 0.2;

function animateCamera(): void {
    camera.currentX +=
        (camera.targetX - camera.currentX) * followStrength;
    camera.currentY +=
        (camera.targetY - camera.currentY) * followStrength;
    camera.currentScale +=
        (camera.targetScale - camera.currentScale) * followStrength;
    camera.currentRotation +=
        (camera.targetRotation - camera.currentRotation) * followStrength;

    const settled =
        Math.abs(camera.currentX - camera.targetX) <= EPSILON &&
        Math.abs(camera.currentY - camera.targetY) <= EPSILON &&
        Math.abs(camera.currentScale - camera.targetScale) <= EPSILON &&
        Math.abs(camera.currentRotation - camera.targetRotation) <= EPSILON
    
    if ( settled ) {
        camera.currentX = camera.targetX;
        camera.currentY = camera.targetY;
        camera.currentScale = camera.targetScale;
        camera.currentRotation = camera.targetRotation;
    }

    cameraElement.setAttribute(
        'transform',
        `translate(${camera.currentX},${camera.currentY})
        scale(${camera.currentScale})
        rotate(${camera.currentRotation * 180 / Math.PI})`,
    )

    if ( settled ) {
        animationFrame = null;
    } {
        animationFrame = requestAnimationFrame(animateCamera);
    }
}

function scheduleCameraAnimation(): void {
    if ( animationFrame === null ) {
        animationFrame = requestAnimationFrame(animateCamera);
    }
}

const HEX_SIZE = 50;

const HEX_DIRECTIONS: HexCoordinate[] = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
];

const RESOURCE_COLORS: Record<string, string> = {
    wood: '#557a55',
    brick: '#a85d4d',
    sheep: '#9da96f',
    wheat: '#c6a653',
    ore: '#68727d',
    desert: '#c2a675',
};

const PLAYER_COLORS: Record<string, string> = {
    red: '#e78284', // red
    blue: '#8caaee', // blue
    white: '#f5f5f5', // text
    yellow: '#e6c890', // yellow
    green: '#a6d189', // green
    brown: '#9a7658',
};

interface Point {
    x: number;
    y: number;
}

function hexId(coordinate: HexCoordinate): HexId {
    return `${coordinate.q},${coordinate.r}`;
}

function getNeighborCoordinates(
    coordinate: HexCoordinate,
): HexCoordinate[] {
    return HEX_DIRECTIONS.map(direction => ({
        q: coordinate.q + direction.q,
        r: coordinate.r + direction.r,
    }));
}

/**
 * Pointy-top axial coordinate -> SVG coordinates.
 */
function hexCenter(coordinate: HexCoordinate): Point {
    return {
        x: HEX_SIZE * Math.sqrt(3) *
            (coordinate.q + coordinate.r / 2),

        y: HEX_SIZE * 3 / 2 *
            coordinate.r,
    };
}

/**
 * Returns the six vertices in clockwise order.
 */
function hexVertices(coordinate: HexCoordinate): Point[] {
    const center = hexCenter(coordinate);

    const points: Point[] = [];

    for ( let i = 0; i < 6; i++ ) {
        // Pointy-top orientation.
        // Starting at the upper-right vertex and moving clockwise.
        const angle = (Math.PI / 180) * (-30 + i * 60);

        points.push({
            x: center.x + HEX_SIZE * Math.cos(angle),
            y: center.y + HEX_SIZE * Math.sin(angle),
        });
    }

    return points;
}

function pointsAttribute(points: Point[]): string {
    return points
        .map(point => `${point.x},${point.y}`)
        .join(' ');
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
): SVGElementTagNameMap[K] {
    return document.createElementNS(
        'http://www.w3.org/2000/svg',
        tag,
    );
}

function renderHex(hex: Hex): void {
    removeHex(hex.coordinate);

    const id = hexId(hex.coordinate);

    const existing = document.querySelector<SVGGElement>(
        `g[data-hex-id="${CSS.escape(id)}]`,
    );
    const group = existing ?? createSvgElement('g');

    group.dataset.hexId = id;
    group.classList.add('hex-group');

    group.replaceChildren();

    // Create hex
    const hexElement = createSvgElement('polygon');
    hexElement.dataset.hexId = id;
    hexElement.dataset.type = 'hex';
    hexElement.classList.add('hex');

    hexElement.setAttribute(
        'points',
        pointsAttribute(hexVertices(hex.coordinate)),
    );

    hexElement.classList.add(hex.resource ?? 'desert');
    
    // hexElement.setAttribute(
    //     'fill',
    //     RESOURCE_COLORS[hex.resource ?? 'desert'] ?? '#ca9ee6'
    // );

    const center = hexCenter(hex.coordinate);
    const rollElement = createSvgElement('text');

    rollElement.classList.add('hex-roll');
    rollElement.textContent = hex.roll ? String(hex.roll) : '?';

    rollElement.setAttribute('x', `${center.x}`);
    rollElement.setAttribute('y', `${center.y}`);

    group.appendChild(hexElement);
    group.appendChild(rollElement);

    if ( hex.robber ) {
        const robberElement = createSvgElement('circle');
        robberElement.classList.add('robber');
        robberElement.setAttribute('cx', `${center.x}`);
        robberElement.setAttribute('cy', `${center.y}`);
        robberElement.setAttribute('r', '20');

        group.appendChild(robberElement);
    }

    hexGrid.hexes.appendChild(group);
}

function removeVirtualHex(id: HexId): void {
    hexGrid.hexes
        .querySelector<SVGPolygonElement>(
            `polygon[data-hex-id="${CSS.escape(id)}"]`,
        )?.remove();
}

function removeHex(coordinate: HexCoordinate): void {
    const id = hexId(coordinate);

    hexGrid.hexes
        .querySelector<SVGGElement>(
            `g[data-hex-id="${CSS.escape(id)}"]`,
        )?.remove();
}

function renderNode(node: GraphNode): void {
    const existing = document.querySelector<SVGGElement>(
        `g[data-node-id="${node.id}"]`,
    );

    const group = existing ?? createSvgElement('g');

    group.dataset.nodeId = String(node.id);
    group.classList.add('node');

    const hex = findHexContainingNode(node.id);

    if ( !hex ) {
        return;
    }

    const vertexIndex = hex.vertices.indexOf(node.id);

    if ( vertexIndex === -1 ) {
        return;
    }

    const point = hexVertices(hex.coordinate)[vertexIndex];

    group.setAttribute(
        'transform',
        `translate(${point.x}, ${point.y})`,
    );

    // Remove previous placement.
    group.replaceChildren();

    switch ( node.type ) {
        case undefined:
            const circle = createSvgElement('circle');

            circle.dataset.type = 'node';
            circle.dataset.nodeId = String(node.id);
            circle.setAttribute('cx', '0');
            circle.setAttribute('cy', '0');
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', '#fff');
            circle.setAttribute('stroke', '#222');
            circle.setAttribute('stroke-width', '2');

            group.appendChild(circle);
            break;
        case 'settlement':
            const square = createSvgElement('rect');
            
            square.dataset.type = 'node';
            square.dataset.nodeId = String(node.id);
            square.setAttribute('x', '-10');
            square.setAttribute('y', '-10');
            square.setAttribute('width', '20');
            square.setAttribute('height', '20');
            square.setAttribute(
                'fill',
                node.player
                    ? PLAYER_COLORS[node.player]
                    : '#fff',
            );
            square.setAttribute('stroke', '#222');
            square.setAttribute('stroke-width', '2');

            group.appendChild(square);
            break;
        case 'city':
            const pentagon = createSvgElement('polygon');
            const points: Point[] = [];

            for ( let i = 0; i < 5; i++ ) {
                const angle = -Math.PI / 2 + i * 2 * Math.PI / 5;

                points.push({
                    x: Math.cos(angle) * 14,
                    y: Math.sin(angle) * 14,
                });
            }

            pentagon.dataset.type = 'node';
            pentagon.dataset.nodeId = String(node.id);
            pentagon.setAttribute(
                'points',
                pointsAttribute(points),
            )
            pentagon.setAttribute(
                'fill',
                node.player
                    ? PLAYER_COLORS[node.player]
                    : '#fff',
            )
            pentagon.setAttribute('stroke', '#222');
            pentagon.setAttribute('stroke-width', '2');

            group.appendChild(pentagon);
            break;
    }

    if ( !existing ) {
        hexGrid.nodes.appendChild(group);
    }
}

function findHexContainingNode(nodeId: NodeId): Hex | undefined {
    for ( const hex of hexMap.values() ) {
        if ( hex.vertices.includes(nodeId) ) {
            return hex;
        }
    }

    return undefined;
}

function renderEdge(edge: GraphEdge): void {
    const existing = document.querySelector<SVGGElement>(
        `g[data-edge-id="${CSS.escape(edge.id)}"]`,
    );

    const group = existing ?? createSvgElement('g');

    group.dataset.edgeId = String(edge.id);
    group.classList.add('edge');

    group.replaceChildren();

    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);

    if ( !from || !to ) {
        return;
    }

    const fromPoint = findNodePoint(from.id);
    const toPoint = findNodePoint(to.id);

    if ( !fromPoint || !toPoint ) {
        return;
    }

    let element = createSvgElement('line');
    let outline: SVGLineElement | undefined = undefined;

    if ( edge.road ) {
        outline = createSvgElement('line');
    
        outline.dataset.edgeId = String(edge.id);
        outline.classList.add('edge-outline');

        group.appendChild(outline);
    }

    element = createSvgElement('line');

    element.dataset.edgeId = String(edge.id);
    element.dataset.type = 'edge';
    element.classList.add('edge');

    group.appendChild(element);

    hexGrid.edges.appendChild(group);

    /*
     * Make the road shorter than the actual hex edge.
     */
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    const shortening = 8;

    const ux = dx / length;
    const uy = dy / length;

    const x1 = fromPoint.x + ux * shortening;
    const y1 = fromPoint.y + uy * shortening;

    const x2 = toPoint.x - ux * shortening;
    const y2 = toPoint.y - uy * shortening;

    element.setAttribute('x1', String(x1));
    element.setAttribute('y1', String(y1));
    element.setAttribute('x2', String(x2));
    element.setAttribute('y2', String(y2));

    if ( edge.road ) element.classList.add(edge.road);

    if ( outline ) {
        outline.setAttribute('x1', String(x1));
        outline.setAttribute('y1', String(y1));
        outline.setAttribute('x2', String(x2));
        outline.setAttribute('y2', String(y2));
    }
}

function findNodePoint(nodeId: NodeId): Point | undefined {
    for ( const hex of hexMap.values() ) {
        const index = hex.vertices.indexOf(nodeId);

        if ( index !== -1 ) {
            return hexVertices(hex.coordinate)[index];
        }
    }

    return undefined;
}

function getVirtualCoordinates(): HexCoordinate[] {
    const virtualIds = new Set<HexId>();

    if ( hexMap.size === 0 ) {
        return [{ q: 0, r: 0 }];
    }

    for ( const hex of hexMap.values() ) {
        for ( const neighbor of getNeighborCoordinates(hex.coordinate) ) {
            const id = hexId(neighbor);

            if ( !hexMap.has(id) ) {
                virtualIds.add(id);
            }
        }
    }

    return [...virtualIds].map(id => {
        const [q, r] = id.split(',').map(Number);

        return { q, r };
    });
}

function renderVirtualHex(coordinate: HexCoordinate, highlight=false): void {
    const el = createSvgElement('polygon');

    el.dataset.type = 'virtual';
    el.dataset.hexId = hexId(coordinate);

    el.classList.add('virtual-hex');
    el.classList.toggle('highlight', highlight);

    el.setAttribute(
        'points',
        pointsAttribute(hexVertices(coordinate)),
    );

    hexGrid.hexes.appendChild(el);
}

function renderVirtualHexes(): void {
    // Remove old virtual hexes.
    document
        .querySelectorAll<SVGPolygonElement>(
            'polygon[data-virtual-hex]',
        )
        .forEach(element => element.remove());

    for ( const coordinate of getVirtualCoordinates() ) {
        renderVirtualHex(coordinate);
    }
}

function renderAll(): void {
    hexGrid.hexes.replaceChildren();
    hexGrid.edges.replaceChildren();
    hexGrid.nodes.replaceChildren();

    // virtual background.
    renderVirtualHexes();

    // Real hexes.
    for ( const hex of hexMap.values() ) {
        renderHex(hex);
    }

    // Edges.
    for ( const edge of edgeMap.values() ) {
        renderEdge(edge);
    }

    // Nodes.
    for ( const node of nodeMap.values() ) {
        renderNode(node);
    }
}

socket.on('init', (hexes, nodes, edges, scores) => {
    hexMap.clear();
    nodeMap.clear();
    edgeMap.clear();

    for ( const hex of hexes ) {
        hexMap.set(
            hexId(hex.coordinate),
            hex,
        );
    }

    for ( const node of nodes ) {
        nodeMap.set(node.id, node);
    }

    for ( const edge of edges ) {
        edgeMap.set(edge.id, edge);
    }

    updateAllPlayers(scores);
    renderAll();
});


socket.on('hex:created', (hex, nodes, edges) => {
    hexMap.set(
        hexId(hex.coordinate),
        hex,
    );

    for ( const node of nodes ) {
        if ( nodeMap.has(node.id) ) continue;
        nodeMap.set(node.id, node);
    }

    for ( const edge of edges ) {
        if ( edgeMap.has(edge.id) ) continue;
        edgeMap.set(edge.id, edge);
    }

    renderAll();
});

// Send over nodes and edges to delete as well
socket.on('hex:deleted', (coordinate, nodes, edges) => {
    if ( !hexMap.has(hexId(coordinate)) ) {
        socket.emit('recover:state');
        return;
    }

    hexMap.delete(
        hexId(coordinate),
    );

    for ( const nodeId of nodes ) {
        nodeMap.delete(nodeId);
    }

    for ( const edgeId of edges ) {
        edgeMap.delete(edgeId);
    }
    
    renderAll();
});

socket.on('hex:setresource', (coordinate, resource) => {
    const hex = hexMap.get(hexId(coordinate));

    if ( !hex ) {
        socket.emit('recover:state');
        return;
    }

    hex.resource = resource;
    renderHex(hex);
});

socket.on('hex:setroll', (coordinate, roll) => {
    const  hex = hexMap.get(hexId(coordinate));

    if ( !hex ) {
        socket.emit('recover:state');
        return;
    }

    hex.roll = roll;
    renderHex(hex);
});

socket.on('hex:movedrobber', (from, to) => {
    let fromHex: Hex | undefined = undefined;
    if ( from ) fromHex = hexMap.get(hexId(from));
    const toHex = hexMap.get(hexId(to));

    if (
        (!from &&
        !fromHex) ||
        !toHex
    ) {
        socket.emit('recover:state');
        return;
    }

    if ( fromHex ) {
        fromHex.robber = false;
        renderHex(fromHex);
    }
    toHex.robber = true;
    renderHex(toHex);
});

socket.on('node:placedsettlement', (nodeId, player) => {
    const node = nodeMap.get(nodeId);

    if ( !node ) {
        socket.emit('recover:state');
        return;
    }

    node.type = 'settlement';
    node.player = player;
    renderNode(node);
});

socket.on('node:placedcity', (nodeId, player) => {
    const node = nodeMap.get(nodeId);

    if ( !node ) {
        socket.emit('recover:state');
        return;
    }

    node.type = 'city';
    node.player = player;
    renderNode(node);
});

socket.on('node:removedplacement', nodeId => {
    const node = nodeMap.get(nodeId);

    if ( !node ) {
        socket.emit('recover:state');
        return;
    }

    node.type = undefined;
    node.player = undefined;
    renderNode(node);
});

socket.on('node:changedplayer', (nodeId, player) => {
    const node = nodeMap.get(nodeId);

    if ( !node ) {
        socket.emit('recover:state');
        return;
    }

    node.player = player;
    renderNode(node);
});

socket.on('edge:placedroad', (edgeId, player) => {
    const edge = edgeMap.get(edgeId);

    if ( !edge ) {
        socket.emit('recover:state');
        return;
    }

    edge.road = player;
    renderEdge(edge);
});

socket.on('edge:removedroad', edgeId => {
    const edge = edgeMap.get(edgeId);

    if ( !edge ) {
        socket.emit('recover:state');
        return;
    }

    edge.road = undefined;
    renderEdge(edge);
});

socket.on('edge:changedplayer', (edgeId, player) => {
    const edge = edgeMap.get(edgeId);

    if ( !edge ) {
        socket.emit('recover:state');
        return;
    }

    edge.road = player;
    renderEdge(edge);
});

socket.on('dice:resources', (coordinates, edges, resourceArray) => {
    // Highlight each coordinate that produced resources
    for ( const coordinate of coordinates ) {
        hexGrid.hexes.querySelector(`polygon.hex[data-hex-id="${CSS.escape(hexId(coordinate))}"]`)
            ?.classList.add('highlight');
    }

    // Highlight each edge of each hex.
    for ( const edgeId of edges ) {
        hexGrid.edges.querySelector(`line.edge[data-edge-id="${CSS.escape(edgeId)}"]`)
            ?.classList.add('highlight');
        hexGrid.edges.querySelector(`line.edge-outline[data-edge-id="${CSS.escape(edgeId)}"]`)
            ?.classList.add('highlight');
    }

    // Remove the highlight after 30 seconds.
    window.setTimeout(() => {
        for ( const coordinate of coordinates ) {
            hexGrid.hexes.querySelector(`polygon.hex[data-hex-id="${CSS.escape(hexId(coordinate))}"]`)
                ?.classList.remove('highlight');
        }

        for ( const edgeId of edges ) {
            hexGrid.edges.querySelector(`line.edge[data-node-id="${CSS.escape(edgeId)}"]`)
                ?.classList.remove('highlight');
            hexGrid.edges.querySelector(`line.edge-outline[data-node-id="${CSS.escape(edgeId)}"]`)
                ?.classList.remove('highlight');
        }
    }, 30000)

    // Convert array to map
    const playerResources = new Map(
        resourceArray.map(([player, entries]) => [
            player as Player,
            new Map(entries as [ResourceId, number][]),
        ]),
    );

    for ( const [player, resources] of playerResources.entries() ) {
        createNotification(player, resources);
    }
})

socket.on('score:update', (player, score) => {
    updatePlayer(player, score);
})

socket.on('edge:highlight', edges => {
    // Highlight each edge.
    for ( const edgeId of edges ) {
        hexGrid.edges.querySelector(`line.edge[data-edge-id="${CSS.escape(edgeId)}"]`)
            ?.classList.add('highlight');
        hexGrid.edges.querySelector(`line.edge-outline[data-edge-id="${CSS.escape(edgeId)}"]`)
            ?.classList.add('highlight');
    }

    // Remove the highlight after 5 seconds.
    window.setTimeout(() => {
        for ( const edgeId of edges ) {
            hexGrid.edges.querySelector(`line.edge[data-edge-id="${CSS.escape(edgeId)}"]`)
                ?.classList.remove('highlight');
            hexGrid.edges.querySelector(`line.edge-outline[data-edge-id="${CSS.escape(edgeId)}"]`)
                ?.classList.remove('highlight');
        }
    }, 5000)
})

type CubeCoordinate = {
    q: number;
    r: number;
    s: number;
}

const DRAG_THRESHOLD = 6;

function cubeToAxial(coordinate: CubeCoordinate): HexCoordinate {
    return {
        q: coordinate.q,
        r: coordinate.r,
    }
}

function axialToCube(coordinate: HexCoordinate): CubeCoordinate {
    return {
        q: coordinate.q,
        r: coordinate.r,
        s: -coordinate.q - coordinate.r,
    }
}

function cubeRound(coordinate: CubeCoordinate): CubeCoordinate {
    let q = Math.round(coordinate.q);
    let r = Math.round(coordinate.r);
    let s = Math.round(coordinate.s);

    const qDiff = Math.abs(q - coordinate.q);
    const rDiff = Math.abs(r - coordinate.r);
    const sDiff = Math.abs(s - coordinate.s);

    if (
        qDiff > rDiff &&
        qDiff > sDiff
    ) {
        q = -r - s;
    } else if ( rDiff > sDiff ) {
        r = -q - s;
    } else {
        s = -q - r;
    }

    return {
        q,
        r,
        s,
    }
}

function axialRound(coordinate: HexCoordinate): HexCoordinate {
    return cubeToAxial(cubeRound(axialToCube(coordinate)));
}

function getHexAtPoint(point: Point): HexCoordinate {
    const x = point.x / HEX_SIZE;
    const y = point.y / HEX_SIZE;
    const q = Math.sqrt(3) * x - (1 / 3) * y;
    const r = (2 / 3) * y;
    return axialRound({
        q,
        r,
    })
}

function getDistance(a: Point, b: Point): number {
    return Math.hypot(
        a.x - b.x,
        a.y - b.y,
    );
}

function getMidpoint(a: Point, b: Point): Point {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    }
}

function clientToSvg(x: number, y: number): DOMPoint {
    const pt = new DOMPoint(x, y);
    return pt.matrixTransform(
        svg.getScreenCTM()?.inverse()
    )
}

function getShortestDelta(
    to: number,
    from: number,
): number {
    let delta = (to - from) % (2 * Math.PI);
    if ( delta > Math.PI ) delta -= (2 * Math.PI);
    if ( delta < -Math.PI ) delta += (2 * Math.PI);
    return delta; 
}

function normalizeAngle(angle: number): number {
    angle %= (2 * Math.PI);
    angle = (angle + (2 * Math.PI)) % (2 * Math.PI);
    if ( angle > Math.PI) angle -= 2 * Math.PI;
    return angle;
}

function createVector(p: Point, color: string): void {
    const e = createSvgElement('line');

    e.setAttribute('x1', '0');
    e.setAttribute('y1', '0');
    e.setAttribute('x2', `${p.x}`);
    e.setAttribute('y2', `${p.y}`);
    e.setAttribute('stroke', color);
    e.setAttribute('stroke-width', '2');

    document.querySelector('#hexgrid')?.appendChild(e);
}

function beginDrag(
    p: DragPointer,
    ev: PointerEvent,
): void {
    p.id = ev.pointerId;
    p.state = 'down';
    p.downTargets.set(ev.pointerId, ev.target);
    p.startPoint = {
        x: ev.clientX,
        y: ev.clientY,
    }
    p.lastPoint = {
        x: ev.clientX,
        y: ev.clientY,
    }
}

function resetDrag(p: DragPointer): void {
    p.id = undefined;
    p.startPoint = undefined;
    p.lastPoint = undefined;
    p.state = 'default';
}

function removePointer(
    g: Gesture,
    ev: PointerEvent,
): void {
    g.evCache.delete(ev.pointerId);
}

function resetGesture(g: Gesture): void {
    g.pinchDistance = null;
    g.lastAngle = null;
}

document.addEventListener('pointerdown', ev => {
    if (
        (ev.target instanceof HTMLElement &&
        ev.target.closest('.context-menu')) ||
        dialog.dialog.open
    ) {
        return;
    }

    document.querySelectorAll('.context-menu')
        .forEach(menu => menu.setAttribute('hidden', ''));

    gesture.evCache.set(ev.pointerId, ev);

    switch ( gesture.evCache.size ) {
        case 1: // 1 pointer exists
            beginDrag(pointer, ev)
            if ( isDoubleClick(ev) ) {
                pointer.doubleClickDetected = true;
                window.clearTimeout(pointer.singleClickTimeout);
                pointer.singleClickTimeout = undefined;
            }
            break;
        case 2: // 2 pointers exist
            // Grab both pointers
            const [a, b] = gesture.evCache.values();

            gesture.pinchDistance = getDistance(a, b);
            gesture.lastAngle = Math.atan2(
                b.clientY - a.clientY,
                b.clientX - a.clientX,
            );

            // Invalidate drag pointer
            resetDrag(pointer);
            break;
    }
})

document.addEventListener('pointermove', ev => {
    // Update gesture pointer event map
    if ( gesture.evCache.has(ev.pointerId) ) {
        gesture.evCache.set(ev.pointerId, ev);
    }

    switch ( gesture.evCache.size ) {
        case 1: // drag
            if (
                pointer.state === 'default' ||
                pointer.id !== ev.pointerId ||
                !pointer.startPoint ||
                !pointer.lastPoint
            ) {
                return;
            }

            const dx = ev.x - pointer.startPoint.x;
            const dy = ev.y - pointer.startPoint.y;

            if (
                pointer.state === 'down' &&
                pointer.doubleClickDetected &&
                Math.hypot(dx, dy) > DRAG_THRESHOLD
            ) {
                pointer.state = 'area-select';
            }

            // If we've moved past the drag threshold and aren't in
            // 'area-select'
            if (
                pointer.state !== 'area-select' &&
                pointer.state === 'down' &&
                Math.hypot(dx, dy) > DRAG_THRESHOLD
            ) {
                pointer.state = 'dragging';
            }

            // If we are dragging
            if ( pointer.state === 'dragging' ) {
                const moveX = ev.x - pointer.lastPoint.x;
                const moveY = ev.y - pointer.lastPoint.y;

                panCamera(moveX, moveY);

                pointer.lastPoint = {
                    x: ev.clientX,
                    y: ev.clientY,
                };
            }

            // If we are selecting an area
            if ( pointer.state === 'area-select' ) {
                const dx = ev.x - pointer.startPoint.x;
                const dy = ev.y -pointer.startPoint.y;

                const hexRadius = Math.hypot(dx, dy) / (HEX_SIZE * Math.sqrt(3));
                const target = pointer.downTargets.get(ev.pointerId);
                
                if ( target instanceof SVGElement ) {
                    const center = target.dataset.hexId;
                    if (
                        !center ||
                        !isCoordinate(center)
                    ) {
                        break;
                    }

                    areaSelect.center = coordinateFromId(center);
                    areaSelect.radius = Math.abs(Math.round(hexRadius));
                    updateVirtualArea(
                        areaSelect.center,
                        areaSelect.radius,
                    );
                }
            }
            break;
        case 2: // pinch/rotate
            if (
                gesture.pinchDistance === null ||
                gesture.lastAngle === null
            ) {
                return;
            }

            const [a, b] = gesture.evCache.values();
            const center = getMidpoint(a, b); // Viewport coordinates, not svg
            
            // Zoom gesture
            const newDistance = getDistance(a, b);
            const zoomFactor = newDistance / gesture.pinchDistance;
            const newScale = Math.max(
                0.5,
                Math.min(
                    camera.targetScale * zoomFactor,
                    4,
                ),
            );
            const scaleRatio = newScale / camera.targetScale;

            // Compensate for scaling
            camera.targetX +=
                (center.x - camera.targetX) * (1 - scaleRatio);
            camera.targetY +=
                (center.y - camera.targetY) * (1 - scaleRatio);
            camera.targetScale = newScale;
            
            gesture.pinchDistance = newDistance;



            // Rotate gesture
            const newAngle = Math.atan2(
                b.clientY - a.clientY,
                b.clientX - a.clientX,
            )
            const deltaAngle = getShortestDelta(
                newAngle,
                gesture.lastAngle,
            );
            // TODO: Create a function that translates to svg coordinates
            // and that doesn't rely on the svg and the viewport having
            // the same origin
            const adjustedCenter = { // Translate to svg coordinates
                x: center.x - camera.targetX,
                y: center.y - camera.targetY,
            }
            const cos = Math.cos(deltaAngle);
            const sin = Math.sin(deltaAngle);
            const rotatedCenter = { // Matrix transform
                x: adjustedCenter.x * cos - adjustedCenter.y * sin,
                y: adjustedCenter.x * sin + adjustedCenter.y * cos,
            }
            const centerDelta = {
                x: rotatedCenter.x - adjustedCenter.x,
                y: rotatedCenter.y - adjustedCenter.y,
            }

            // Compensate for rotation
            camera.targetX -= centerDelta.x;
            camera.targetY -= centerDelta.y;
            camera.targetRotation += deltaAngle;

            gesture.lastAngle = newAngle;
            scheduleCameraAnimation();
            break;
    }
})

function handlePointerUp(ev: PointerEvent): void {
    removePointer(gesture, ev);

    if ( pointer.id === ev.pointerId ) {
        selection.el = undefined;
    }

    if ( gesture.evCache.size < 2 ) {
        resetGesture(gesture);
    }
}

function recordClick(ev: PointerEvent): void {
    pointer.lastClick.time = performance.now();
    pointer.lastClick.x = ev.clientX;
    pointer.lastClick.y = ev.clientY;
    pointer.lastClick.target = ev.target;
}

function isDoubleClick(ev: PointerEvent): boolean {
    const now = performance.now();

    const elapsed = now - pointer.lastClick.time;
    const dx = ev.clientX - pointer.lastClick.x;
    const dy = ev.clientY - pointer.lastClick.y;

    return elapsed <= CLICK_DELAY &&
        elapsed >= 0 &&
        Math.hypot(dx, dy) <= CLICK_DISTANCE &&
        ev.target === pointer.lastClick.target;
}

function scheduleClick(ev: PointerEvent): void {
    if ( pointer.doubleClickDetected ) {
        if ( pointer.singleClickTimeout !== undefined ) {
            window.clearTimeout(pointer.singleClickTimeout);
            pointer.singleClickTimeout = undefined;
        }

        handleDoubleClick(ev);
        return;
    }

    const clickTarget = pointer.downTargets.get(ev.pointerId);

    pointer.singleClickTimeout = window.setTimeout(() => {
        pointer.singleClickTimeout = undefined;

        if ( clickTarget ) {
            handleSingleClick(clickTarget, ev);
        }
    }, CLICK_DELAY);
}

function handleSingleClick(target: EventTarget, ev: PointerEvent): void {
    // TODO: Create a class for a context menu
    if ( target instanceof SVGElement ) {
        selection.el = target;

        switch ( target.dataset.type ) {
            case 'virtual':
                // TODO: Create a context menu for a virtual hex that contains
                // a 'create' button.
                break;
            case 'hex':
                const hexMenu = document.querySelector('#hex-context-menu');
                if ( !(hexMenu instanceof HTMLElement) ) break;

                // TODO: Turn unhiding a menu into a function
                hexMenu.style.setProperty('left', `${ev.clientX}px`);
                hexMenu.style.setProperty('top', `${ev.clientY}px`);
                hexMenu.hidden = false;
                break;
            case 'node':
                const nodeMenu = document.querySelector('#node-context-menu');

                if ( !(nodeMenu instanceof HTMLElement) ) break;

                const placeSettlement = nodeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="place-settlement"]');
                const placeCity = nodeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="place-city"]');
                const removePlacement = nodeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="remove-placement"]');
                const changeNodePlayer = nodeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="change-player"]');
                
                if (
                    !placeSettlement ||
                    !placeCity ||
                    !removePlacement ||
                    !changeNodePlayer
                ) {
                    throw new Error("Node context menu has invalid structure");
                }

                if ( !target.dataset.nodeId ) {
                    throw new Error("Id for selected node does not exist");
                }

                const node = nodeMap.get(target.dataset.nodeId);

                if ( !node ) break;

                placeSettlement.hidden = false;
                placeCity.hidden = false;
                removePlacement.hidden = false;
                changeNodePlayer.hidden = false;
                    
                switch ( node.type ) {
                    case 'city':
                        placeCity.hidden = true;
                        break;
                    case 'settlement':
                        placeSettlement.hidden = true;
                        break;
                    case undefined:
                        removePlacement.hidden = true;
                        changeNodePlayer.hidden = true;
                        break;
                }

                nodeMenu.style.setProperty('left', `${ev.clientX}px`);
                nodeMenu.style.setProperty('top', `${ev.clientY}px`);
                nodeMenu.hidden = false;
                break;
            case 'edge':
                const edgeMenu = document.querySelector('#edge-context-menu');

                if ( !(edgeMenu instanceof HTMLElement) ) break;

                const placeRoad = edgeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="place-road"]');
                const removeRoad = edgeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="remove-road"]');
                const changeEdgePlayer = edgeMenu
                    .querySelector<HTMLButtonElement>('button[data-action="change-player"]');

                if (
                    !placeRoad ||
                    !removeRoad ||
                    !changeEdgePlayer
                ) {
                    break;
                }

                if ( !target.dataset.edgeId ) break;

                const edge = edgeMap.get(target.dataset.edgeId);

                if ( !edge ) break;

                placeRoad.hidden = false;
                removeRoad.hidden = false;
                changeEdgePlayer.hidden = false;

                if ( edge.road ) {
                    placeRoad.hidden = true;
                } else {
                    removeRoad.hidden = true;
                    changeEdgePlayer.hidden = true;
                }

                edgeMenu.style.setProperty('left', `${ev.clientX}px`);
                edgeMenu.style.setProperty('top', `${ev.clientY}px`);
                edgeMenu.hidden = false;
                break;
        }
    }
}

function handleDoubleClick(ev: PointerEvent): void {
    const target = pointer.downTargets.get(ev.pointerId);

    if ( target === undefined ) return;

    if ( target instanceof SVGElement ) {
        switch ( target.dataset.type ) {
            case 'virtual': // Create hex on double click
                if (
                    !target.dataset.hexId ||
                    !isCoordinate(target.dataset.hexId)
                ) {
                    break;
                }

                socket.emit(
                    'hex:create',
                    coordinateFromId(target.dataset.hexId),
                );
                break;
            case 'node': // Downgrade a city/Upgrade a settlement
                if ( !target.dataset.nodeId ) {
                    throw new Error(`Node ${target.dataset.nodeId} does not exist`);
                }

                const node = nodeMap.get(target.dataset.nodeId);

                if ( !node ) break;

                switch ( node.type ) {
                    case 'city':
                        socket.emit(
                            'node:downgrade',
                            target.dataset.nodeId,
                        )
                        break;
                    case 'settlement':
                        socket.emit(
                            'node:upgrade',
                            target.dataset.nodeId,
                        )
                        break;
                }
        }
    }
}

document.addEventListener('pointerup', ev => {
    handlePointerUp(ev);

    switch ( gesture.evCache.size ) {
        case 0: // 0 pointers
            // Check if this is a 'click'
            if (
                pointer.id === ev.pointerId &&
                pointer.state === 'down'
            ) { // Treat this as a 'click'
                scheduleClick(ev);
                recordClick(ev);
            }

            pointer.doubleClickDetected = false;

            // Send area to be created if it exists
            if (
                areaSelect.center &&
                areaSelect.radius
            ) {
                socket.emit(
                    'hex:createarea',
                    areaSelect.center,
                    areaSelect.radius,
                )
            }

            areaSelect.center = undefined;
            areaSelect.radius = undefined;

            // Invalidate drag pointer after click
            resetDrag(pointer);
            removeVirtualArea();
            break;
        case 1: // 1 pointer
            // Set this pointer as the current drag pointer
            const [remaining] = gesture.evCache.values();
            beginDrag(pointer, remaining);
            break;
    }
})

// Handle a cancled pointer
document.addEventListener('pointercancel', handlePointerUp);

document.addEventListener('wheel', ev => {
    ev.preventDefault();

    camera.targetScale = Math.max(
        0.5,
        Math.min(4, camera.targetScale - ev.deltaY * 0.001)
    );

    scheduleCameraAnimation();
})

// Button handlers
document.querySelectorAll<HTMLElement>('.context-menu button')
    ?.forEach(button => button.addEventListener('click', ev => {
        if ( 
            !selection.el ||
            !(ev.target instanceof HTMLElement)
        ) return;

        let node: GraphNode | undefined = undefined;

        switch ( ev.target.dataset.action ) {
            case 'place-robber':
                if (
                    !selection.el.dataset.hexId ||
                    !isCoordinate(selection.el.dataset.hexId)
                ) {
                    break;
                }

                socket.emit(
                    'hex:moverobber',
                    coordinateFromId(selection.el.dataset.hexId),
                );
                break;
            case 'assign-roll':
                if (
                    !selection.el.dataset.hexId ||
                    !isCoordinate(selection.el.dataset.hexId)
                ) {
                    break;
                }
                
                dialog
                    .setType('assign-roll')
                    .chooseRoll(selection.el)
                    .open("Roll");
                break;
            case 'assign-resource':
                if (
                    !selection.el.dataset.hexId ||
                    !isCoordinate(selection.el.dataset.hexId)
                ) {
                    break;
                }

                dialog
                    .setType('assign-resource')
                    .chooseResource(selection.el)
                    .open("Resource");
                break;
            case 'remove-hex':
                if (
                    !selection.el.dataset.hexId ||
                    !isCoordinate(selection.el.dataset.hexId)
                ) {
                    break;
                }

                socket.emit(
                    'hex:delete',
                    coordinateFromId(selection.el.dataset.hexId),
                );
                break;
            case 'place-settlement':
                if ( !selection.el.dataset.nodeId ) break;

                node = nodeMap.get(selection.el.dataset.nodeId);

                if ( !node ) break;

                if ( !node.type ) {
                    dialog.setType('place-settlement')
                    .choosePlayer(selection.el)
                    .open('Placing Settlement');
                } else {
                    socket.emit(
                        'node:downgrade',
                        selection.el.dataset.nodeId,
                    );
                }
                break;
            case 'place-city':
                if ( !selection.el.dataset.nodeId ) break;

                node = nodeMap.get(selection.el.dataset.nodeId);

                if ( !node ) break;

                if ( !node.type ) {
                    dialog
                        .setType('place-city')
                        .choosePlayer(selection.el)
                        .open('Placing City');
                } else {
                    socket.emit(
                        'node:upgrade',
                        selection.el.dataset.nodeId,
                    );
                }
                break;
            case 'remove-placement':
                if ( !selection.el.dataset.nodeId ) break;

                socket.emit(
                    'node:removeplacement',
                    selection.el.dataset.nodeId,
                )
                break;
            case 'change-player':
                dialog
                    .setType('change-player')
                    .choosePlayer(selection.el)
                    .open('Changing Player');
                break;
            case 'place-road':
                if ( !selection.el.dataset.edgeId ) break;

                dialog
                    .setType('place-road')
                    .choosePlayer(selection.el)
                    .open('Placing Road');
                break;
            case 'remove-road':
                if ( !selection.el.dataset.edgeId ) break;

                socket.emit(
                    'edge:removeroad',
                    selection.el.dataset.edgeId,
                )
                break;
        }

        document.querySelectorAll('.context-menu')
            .forEach(menu => menu.setAttribute('hidden', ''));
    }));

function coordinateFromId(id: HexId): HexCoordinate {
    const [q, r] = id.split(',').map(Number);
    return { q, r };
}

function isCoordinate(value: string): value is HexId {
    return /^-?\d+,-?\d+$/.test(value);
}

function isResource(value: string): value is ResourceId {
    const validResources: Set<ResourceId> = new Set(
        [
            'ore',
            'sheep',
            'wheat',
            'brick',
            'wood',
        ]
    )
    
    return validResources.has(value as ResourceId);
}

type DiceRoll =
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '8'
    | '9'
    | '10'
    | '11'
    | '12';

function isDiceRoll(value: string): value is DiceRoll {
    const validDiceRolls: Set<DiceRoll> = new Set(
        [
            '2',
            '3',
            '4',
            '5',
            '6',
            '8',
            '9',
            '10',
            '11',
            '12',
        ]
    )

    return validDiceRolls.has(value as DiceRoll);
}

function isPlayer(value: string): value is Player {
    const validPlayers: Set<Player> = new Set(
        [
            'red',
            'blue',
            'white',
            'yellow',
            'green',
            'brown',
        ]
    )

    return validPlayers.has(value as Player);
}

function createNotification(
    player: Player,
    resources: Map<ResourceId, number>,
): void {
    const container = document.querySelector<HTMLDivElement>('#notifications');

    if ( !container ) {
        throw new Error('Notification container does not exist');
    }

    const notification = document.createElement('div');
    const resourceArray: string[] = [];

    for ( const [resource, number] of resources.entries() ) {
        resourceArray.push(`+${number} ${resource}`);
    }

    notification.classList.add('notification');
    notification.innerHTML = `
        <button class="close-button">&times;</button>
        <h2>${player}</h2>
        <p class="resources">${resourceArray.join(' ')}</div>
    `;
    
    notification.querySelector<HTMLButtonElement>('button.close-button')
        ?.addEventListener('click', () => {
            notification.remove();
        })
    
    container.appendChild(notification);
}

function updateScorebar(): void {
    const playerList: Player[] = ['red', 'blue', 'white', 'yellow', 'green', 'brown'];
    
    let allHidden = true;

    for ( const player of playerList ) {
        if ( !playerScores[player].hidden ) {
            allHidden = false;
            break;
        }
    }

    const scorebar = document.querySelector<HTMLDivElement>('div#scorebar');

    if ( !scorebar ) {
        throw new Error('Scorebar does not exist');
    }

    scorebar.hidden = allHidden;
}

function updatePlayer(
    player: Player,
    score: number,
): void {
    const scoreEl = playerScores[player]
        ?.querySelector<HTMLParagraphElement>('p.player-score');

    if ( !scoreEl ) {
        throw new Error(`Player ${player} score card does not exist`);
    }

    scoreEl.textContent = String(score);

    if ( score <= 0) {
        playerScores[player].hidden = true;
    } else {
        playerScores[player].hidden = false;
    }

    updateScorebar();
}

function updateAllPlayers(scores: Record<Player, number>): void {
    const playerList: Player[] = ['red', 'blue', 'white', 'yellow', 'green', 'brown'];
    playerList.forEach(player => updatePlayer(player, scores[player]));
}

document.querySelector<HTMLButtonElement>('button[data-action="input-roll"]')
    ?.addEventListener('click', () => {
        dialog
            .setType('roll-dice')
            .chooseRoll(null)
            .open("Rolling Dice");
    });

document.querySelector<HTMLButtonElement>('button[data-action="assign-longest-road"]')
    ?.addEventListener('click', () => {
        dialog
            .setType('assign-longest-road')
            .choosePlayer(null)
            .open("Assinging Longest Road");
    });

document.querySelector<HTMLButtonElement>('button[data-action="assign-largest-army"]')
    ?.addEventListener('click', () => {
        dialog
            .setType('assign-largest-army')
            .choosePlayer(null)
            .open("Assigning Largest Army");
    });

document.querySelector<HTMLButtonElement>('button[data-action="find-longest-road"]')
    ?.addEventListener('click', () => {
        socket.emit('score:findlongestroad');
    });

function removeVirtualArea(): void {
    for ( const hexId of [...virtualAreaHexes.values()] ) {
        removeVirtualHex(hexId);
    }

    
    for ( const hexId of [...highlightedArea.values()] ) {
        hexGrid.hexes
        .querySelector<SVGElement>(
            `g[data-hex-id="${CSS.escape(hexId)}"]`,
        )?.classList.toggle('highlight', false);
    }
    
    virtualAreaHexes.clear();
    highlightedArea.clear();
}

function updateVirtualArea(
    center: HexCoordinate,
    radius: number,
): void {
    radius = Math.abs(Math.round(radius));

    const ids: Set<HexId> = new Set();
    for ( let q = -radius; q <= radius; q++ ) {
        for ( let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
            const coordinate = addCoordinates(center, { q, r });
            ids.add(hexId(coordinate));
        }
    }

    // Delete each virtual hex that we don't need and remove each virtual hex
    // we already have, so we don't duplicate it.
    for ( const hexId of [...virtualAreaHexes.values()] ) {
        if ( ids.has(hexId) ) {
            ids.delete(hexId);
        } else {
            removeVirtualHex(hexId);
            virtualAreaHexes.delete(hexId);
        }
    }

    // Remove the highlight from each hex we don't need and remove each
    // highlighted hex we already have.
    for ( const hexId of [...highlightedArea.values()] ) {
        if ( ids.has(hexId) ) {
            ids.delete(hexId);
        } else {
            hexGrid.hexes
                .querySelector<SVGGElement>(
                    `[data-hex-id="${CSS.escape(hexId)}"]`,
                )?.classList.toggle('highlight', false);
            highlightedArea.delete(hexId);
        }
    }

    // Check if we have a hex of this type, if not, create it, otherwise,
    // highlight it.
    for ( const hexId of ids.values() ) {
        const virtualCoordinate = coordinateFromId(hexId);

        const el = hexGrid.hexes
            .querySelector<SVGElement>(
                `[data-hex-id="${CSS.escape(hexId)}"]`,
            );
        
        if ( el === null ) {
            virtualAreaHexes.add(hexId);
            renderVirtualHex(virtualCoordinate, true);
        } else {
            highlightedArea.add(hexId);
            el.classList.toggle('highlight', true);
        }
    }
}

/**
 * Adds two axial coordinates.
 * 
 * @param a Axial coordinate to add to the other.
 * @param b Axial coordinate to add to the other.
 * @returns The sum of `a` and `b`.
 */
export function addCoordinates(
    a: HexCoordinate,
    b: HexCoordinate
): HexCoordinate {
    return {
        q: a.q + b.q,
        r: a.r + b.r,
    }
}
