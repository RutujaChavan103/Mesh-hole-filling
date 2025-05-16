/***********************Dijkstra Algorithm****************************************/

import { Mesh, VertexBuffer } from "@babylonjs/core";

/* From https://medium.com/@adriennetjohnson/a-walkthrough-of-dijkstras-algorithm-in-javascript-e94b74192026 */
export class Graph {
    nodes: Set<number>;
    adjacencyList: { [key: number]: { node: number; weight: number }[] };
    adjacents: { [key: number]: Set<number> };

    constructor() {
        this.nodes = new Set();
        this.adjacencyList = {};
        this.adjacents = {};
    }

    addNode(node: number): void {
        if (!this.nodes.has(node)) {
            this.nodes.add(node);
            this.adjacencyList[node] = [];
            this.adjacents[node] = new Set();
        }
    }

    addEdge(node1: number, node2: number, positions: number[]): void {
        if (!(this.adjacents[node1].has(node2) && this.adjacents[node2].has(node1))) {
            var weight = Math.pow(positions[3 * node1] - positions[3 * node2], 2) +
                Math.pow(positions[3 * node1 + 1] - positions[3 * node2 + 1], 2) +
                Math.pow(positions[3 * node1 + 2] - positions[3 * node2 + 2], 2);
            this.adjacencyList[node1].push({ node: node2, weight: weight });
            this.adjacencyList[node2].push({ node: node1, weight: weight });
            this.adjacents[node1].add(node2);
            this.adjacents[node2].add(node1);
        }
    }

    findPathWithDijkstra(startNode: number, endNode: number): number[] {
        let distances: { [key: number]: number } = {};
        let backtrace: { [key: number]: number } = {};
        let pq = new PriorityQueue();

        distances[startNode] = 0;

        this.nodes.forEach(node => {
            if (node !== startNode) {
                distances[node] = Infinity;
            }
        });

        pq.enqueue([startNode, 0]);

        while (!pq.isEmpty()) {
            let shortestStep = pq.dequeue();
            let currentNode = shortestStep[0];
            this.adjacencyList[currentNode].forEach(neighbor => {
                let distance = distances[currentNode] + neighbor.weight;

                if (distance < distances[neighbor.node]) {
                    distances[neighbor.node] = distance;
                    backtrace[neighbor.node] = currentNode;
                    pq.enqueue([neighbor.node, distance]);
                }
            });
        }

        let path: number[] = [endNode];
        let lastStep = endNode;
        while (lastStep !== startNode) {
            path.unshift(backtrace[lastStep]);
            lastStep = backtrace[lastStep];
        }
        console.log("distance", distances[endNode]);
        return path;
    }
}

export class PriorityQueue {
    collection: [number, number][];

    constructor() {
        this.collection = [];
    }

    enqueue(element: [number, number]): void {
        if (this.isEmpty()) {
            this.collection.push(element);
        } else {
            let added = false;
            for (let i = 1; i <= this.collection.length; i++) {
                if (element[1] < this.collection[i - 1][1]) {
                    this.collection.splice(i - 1, 0, element);
                    added = true;
                    break;
                }
            }
            if (!added) {
                this.collection.push(element);
            }
        }
    }

    dequeue(): [number, number] {
        let value = this.collection.shift();
        return value!;
    }

    isEmpty(): boolean {
        return (this.collection.length === 0);
    }
}

export function graphFrom(mesh: Mesh): Graph {
    var graph = new Graph();
    var v: number[] = [];
    var positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) {
        throw new Error("Positions are null");
    }
    var indices = mesh.getIndices();
    if (!indices) {
        throw new Error("Indices are null");
    }
    var indLen = indices.length / 3;
    for (var index = 0; index < indLen; index++) {
        v[0] = indices[3 * index];
        v[1] = indices[3 * index + 1];
        v[2] = indices[3 * index + 2];
        for (var i = 0; i < 3; i++) {
            graph.addNode(v[i]);
        }
        for (var i = 0; i < 3; i++) {
            graph.addEdge(v[i], v[(i + 1) % 3], positions as number[]);
        }
    }
    return graph;
}