import { Mesh, Scene, Vector3, VertexData, Matrix, Ray, PickingInfo, Octree, VertexBuffer, FloatArray, IndicesArray, MeshBuilder } from "@babylonjs/core";
import { Graph, graphFrom } from "./dijkstra";
import { TriangleMesh } from "./aabb/TriangleMesh";
import { splitMeshTriangle } from "./splitTriangle";



export interface ProjectedPoint {
    point: Vector3;
    faceId: number;
    baryCoords?: Vector3;
    isOnEdge?: boolean;
    edgeVertices?: [number, number];
    vertexIndex?: number;
}

export class MeshSplit {
    private _sourceMesh: Mesh;
    private _graph: Graph;
    private _scene: Scene;
    private _projectedPoints: ProjectedPoint[] = [];
    private _triangleMesh!: TriangleMesh;

    constructor(mesh: Mesh, scene: Scene) {
        this._sourceMesh = mesh;
        this._scene = scene;
        this._graph = new Graph();
        this._initialize();
    }

    private _initialize(): void {
        this._triangleMesh = new TriangleMesh(this._sourceMesh);

    }

    public splitByPolyline(polyline: Vector3[]): [Mesh, Mesh] {
        // Project polyline points onto mesh
        this._projectPolylineOntoMesh(polyline);

        // Create a vertices on mesh at the projected points
        this._createVerticesAtProjectedPoints();
        
        // Find paths between projected points
        const paths = this._findPathsBetweenPoints();
        
        this._visualizePath(paths);

        // // Split mesh using the paths
        // return this._splitMeshByPaths(paths);
        return [this._sourceMesh, this._sourceMesh];
    }

    private _createVerticesAtProjectedPoints(): void {
        for(let i = 0; i < this._projectedPoints.length; i++) {
            const projectedPoint = this._projectedPoints[i];
            if(!projectedPoint || !projectedPoint.baryCoords) continue;

            const splitPoint = projectedPoint.point;
            const splitTriangleId = projectedPoint.faceId;

            splitMeshTriangle(this._sourceMesh, splitTriangleId, projectedPoint);
        }
    }

    private _projectPolylineOntoMesh(polyline: Vector3[]): void {
        for (const point of polyline) {
            const projectedPoint = this._projectPointOntoMesh(point);
            if (projectedPoint) {
                this._projectedPoints.push(projectedPoint);
                console.log({point, projectedPoint});
            }
        }
    }

    private _projectPointOntoMesh(point: Vector3): ProjectedPoint | null {
        let closestDistance = Number.MAX_VALUE;
        let closestProjection: ProjectedPoint | null = null;

        // Use the triangle octree to find potential triangles
        const potentialTriangle = this._triangleMesh.findClosestTriangle(point);

        if (!potentialTriangle) return null;


        // Convert SmartArray to a regular array for iteration
       // for (let i = 0; i < [potentialTriangles].length; i++) {
            const triangle = potentialTriangle; // Access the triangle using the data property
            const projection = this._projectPointOnTriangle(point, triangle.v1, triangle.v2, triangle.v3);
            if (!projection) return null;

            const distance = Vector3.Distance(point, projection.point);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestProjection = {
                    point: projection.point,
                    faceId: triangle.index,
                    baryCoords: projection.baryCoords,
                    isOnEdge: projection.isOnEdge,
                    edgeVertices: projection.edgeVertices
                };
            }
        //}

        return closestProjection;
    }

    private _projectPointOnTriangle(
        point: Vector3,
        v1: Vector3,
        v2: Vector3,
        v3: Vector3
    ): { point: Vector3; baryCoords: Vector3; isOnEdge: boolean; edgeVertices?: [number, number] } | null {
        // Calculate triangle normal
        const normal = Vector3.Cross(
            v2.subtract(v1),
            v3.subtract(v1)
        ).normalize();

        // Calculate plane equation: ax + by + cz + d = 0
        const d = -(normal.x * v1.x + normal.y * v1.y + normal.z * v1.z);

        // Project point onto triangle plane
        const t = -(normal.x * point.x + normal.y * point.y + normal.z * point.z + d) /
            (normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);

        const projectedPoint = new Vector3(
            point.x + t * normal.x,
            point.y + t * normal.y,
            point.z + t * normal.z
        );

        // Calculate barycentric coordinates
        const area = Vector3.Cross(v2.subtract(v1), v3.subtract(v1)).length() / 2;
        const alpha = Vector3.Cross(v2.subtract(projectedPoint), v3.subtract(projectedPoint)).length() / (2 * area);
        const beta = Vector3.Cross(v3.subtract(projectedPoint), v1.subtract(projectedPoint)).length() / (2 * area);
        const gamma = 1 - alpha - beta;

        // Check if point is inside triangle or on edge
        const EPSILON = 0.000001;
        const isOnEdge = 
            (Math.abs(alpha) < EPSILON && beta >= 0 && beta <= 1) ||
            (Math.abs(beta) < EPSILON && gamma >= 0 && gamma <= 1) ||
            (Math.abs(gamma) < EPSILON && alpha >= 0 && alpha <= 1);

        let edgeVertices: [number, number] | undefined;
        
        if (isOnEdge) {
            // Determine which edge the point is on
            if (Math.abs(alpha) < EPSILON) edgeVertices = [1, 2];
            else if (Math.abs(beta) < EPSILON) edgeVertices = [2, 0];
            else if (Math.abs(gamma) < EPSILON) edgeVertices = [0, 1];
        }

        // Check if projection is inside or on the triangle
        if ((alpha >= -EPSILON && beta >= -EPSILON && gamma >= -EPSILON) &&
            (Math.abs(alpha + beta + gamma - 1) < EPSILON)) {
            return {
                point: projectedPoint,
                baryCoords: new Vector3(alpha, beta, gamma),
                isOnEdge,
                edgeVertices
            };
        }

        return null;
    }

    private _findPathsBetweenPoints(): number[] {

        this._graph = graphFrom(this._sourceMesh);
        
        // Implementation of Dijkstra's algorithm to find shortest path
        // between projected points on the mesh surface
        const paths: number[] = [];
        
        for (let i = 0; i < this._projectedPoints.length - 1; i++) {
            const start = this._projectedPoints[i].vertexIndex;
            const end = this._projectedPoints[i + 1].vertexIndex;
            if (!start || !end) continue;

            const path = this._findShortestPath(start, end);
            paths.push(...path);
        }
        
        return paths;
    }

    private _findShortestPath(start: number, end: number): number[] {
        const path = this._graph.findPathWithDijkstra(start, end);
        return path;
    }

    private _visualizePath(path: number[]): void {
        // get points from the path from vertex indices.
        const vertices = this._sourceMesh.getVerticesData(VertexBuffer.PositionKind);
        if (!vertices) throw new Error("Mesh has no vertices");
        
        const pathPoints = [];
        for(let i = 0; i < path.length; i++) {
            const vertexIndex = path[i];
            const vertex = new Vector3(vertices[vertexIndex * 3], vertices[vertexIndex * 3 + 1], vertices[vertexIndex * 3 + 2]);
            pathPoints.push(vertex);
        }

        // create a line mesh
        const lineMesh = MeshBuilder.CreateLines("path", {
            points: pathPoints,
        });

        lineMesh.position = this._sourceMesh.position;
        this._scene.addMesh(lineMesh);
    }

    private _splitMeshByPaths(paths: number[]): [Mesh, Mesh] {
        // Create new vertex data for both meshes
        const meshData1: VertexData = new VertexData();
        const meshData2: VertexData = new VertexData();

        // Split the mesh data based on the cutting path
        this._splitMeshData(paths, meshData1, meshData2);

        // Create new meshes
        const mesh1 = new Mesh("split1", this._scene);
        const mesh2 = new Mesh("split2", this._scene);

        meshData1.applyToMesh(mesh1);
        meshData2.applyToMesh(mesh2);

        return [mesh1, mesh2];
    }

    private _splitMeshData(paths: number[], meshData1: VertexData, meshData2: VertexData): void {
        // Create new vertices along the cutting path
        const newVertices = this._createNewVerticesAlongPath(paths);
        
        // Separate triangles into two groups based on the cutting path
        const [indices1, indices2] = this._separateTriangles(newVertices);
        
        // Assign vertex data to both mesh parts
        this._assignVertexData(meshData1, indices1);
        this._assignVertexData(meshData2, indices2);
    }

    private _createNewVerticesAlongPath(paths: number[]): number[] {
        // Create new vertices where the path intersects mesh edges
        const newVertices: number[] = [];
        // Implementation details...
        return newVertices;
    }

    private _separateTriangles(cuttingVertices: number[]): [number[], number[]] {
        // Separate triangles into two groups based on the cutting path
        const indices1: number[] = [];
        const indices2: number[] = [];
        // Implementation details...
        return [indices1, indices2];
    }

    private _assignVertexData(meshData: VertexData, indices: number[]): void {
        // Assign vertices, indices, and normals to the new mesh data
        const positions = this._sourceMesh.getVerticesData(VertexBuffer.PositionKind);
        if (!positions) throw new Error("Mesh has no positions");
        meshData.positions = new Float32Array(positions);
        meshData.indices = indices;
        const normals = this._sourceMesh.getVerticesData(VertexBuffer.NormalKind);
        if (!normals) throw new Error("Mesh has no normals");
        meshData.normals = new Float32Array(normals);
    }
}

