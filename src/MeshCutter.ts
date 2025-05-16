import { Scene, Mesh, Vector3, CSG, VertexData } from '@babylonjs/core';

import {SurfaceMeshCreator} from './SurfaceMeshCreator'

interface CutOptions {
    scaleFactor?: number;
    meshQuality?: number;
}

interface Vertex {
    position: Vector3;
    index: number;
    edges: Edge[];
}

interface Edge {
    v1: Vertex;
    v2: Vertex;
    weight: number;
    triangles: Triangle[];
}

interface Triangle {
    vertices: [Vertex, Vertex, Vertex];
    normal: Vector3;
    area: number;
}

export class MeshCutter {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public cutMeshWithPolyline(
        targetMesh: Mesh,
        polylinePoints: Vector3[],
        options: CutOptions = {}
    ): Mesh {
        const {
            scaleFactor = 1.2,
            meshQuality = 0.1
        } = options;

        // Create surface using hole filling
        //const cuttingSurface = this.createSurfaceFromBoundary(polylinePoints, meshQuality);

        const surfOpt = {
            tolerance: 0.0005,
            alpha: 0.1
        };
        
        // Create the surface mesh
        const surfaceMesh = SurfaceMeshCreator.createSurfaceMesh(this.scene, polylinePoints, surfOpt);
        
        // Adjust and perform cut
        //this.adjustCuttingSurface(cuttingSurface, targetMesh, scaleFactor);
        //const cutResult = this.performCut(targetMesh, cuttingSurface);
        
        //cuttingSurface.dispose();
        //return cutResult;
        return surfaceMesh;
    }

    private createSurfaceFromBoundary(points: Vector3[], quality: number): Mesh {
        // Ensure boundary is closed
        if (!points[0].equals(points[points.length - 1])) {
            points.push(points[0].clone());
        }

        // Create vertex and edge data structures
        const vertices = this.createVertices(points);
        const edges = this.createEdges(vertices);
        const triangles: Triangle[] = [];

        // Initial triangulation using minimal area triangles
        this.initialTriangulation(vertices, edges, triangles);

        // Optimize mesh quality
        this.optimizeMeshQuality(triangles, edges, quality);

        // Create Babylon.js mesh from triangulation
        return this.createMeshFromTriangulation(triangles);
    }

    private createVertices(points: Vector3[]): Vertex[] {
        return points.map((point, index) => ({
            position: point.clone(),
            index: index,
            edges: []
        }));
    }

    private createEdges(vertices: Vertex[]): Edge[] {
        const edges: Edge[] = [];
        
        // Create boundary edges
        for (let i = 0; i < vertices.length - 1; i++) {
            const edge = {
                v1: vertices[i],
                v2: vertices[i + 1],
                weight: Vector3.Distance(vertices[i].position, vertices[i + 1].position),
                triangles: []
            };
            edges.push(edge);
            vertices[i].edges.push(edge);
            vertices[i + 1].edges.push(edge);
        }

        return edges;
    }

    private initialTriangulation(vertices: Vertex[], edges: Edge[], triangles: Triangle[]): void {
        // Implementation of Liepa's algorithm for initial triangulation
        
        // 1. Find minimal area triangles
        while (this.canAddTriangle(vertices, edges)) {
            const triangle = this.findMinimalAreaTriangle(vertices, edges);
            if (triangle) {
                triangles.push(triangle);
                this.updateDataStructures(triangle, edges);
            }
        }
    }

    private findMinimalAreaTriangle(vertices: Vertex[], edges: Edge[]): Triangle | null {
        let minArea = Infinity;
        let bestTriangle: Triangle | null = null;

        // For each edge, find potential completing vertices that form valid triangles
        for (const edge of edges) {
            for (const vertex of vertices) {
                if (vertex === edge.v1 || vertex === edge.v2) continue;

                if (this.isValidNewTriangle(edge, vertex, edges)) {
                    const triangle = this.createTriangle(edge.v1, edge.v2, vertex);
                    if (triangle.area < minArea) {
                        minArea = triangle.area;
                        bestTriangle = triangle;
                    }
                }
            }
        }

        return bestTriangle;
    }

    private createTriangle(v1: Vertex, v2: Vertex, v3: Vertex): Triangle {
        const normal = this.calculateTriangleNormal(
            v1.position,
            v2.position,
            v3.position
        );

        const area = this.calculateTriangleArea(
            v1.position,
            v2.position,
            v3.position
        );

        return {
            vertices: [v1, v2, v3],
            normal: normal,
            area: area
        };
    }

    private isValidNewTriangle(edge: Edge, vertex: Vertex, edges: Edge[]): boolean {
        // Check if triangle intersects existing edges
        const triangleEdges = [
            { start: edge.v1.position, end: vertex.position },
            { start: edge.v2.position, end: vertex.position }
        ];

        for (const existingEdge of edges) {
            for (const triangleEdge of triangleEdges) {
                if (this.edgesIntersect(
                    triangleEdge.start,
                    triangleEdge.end,
                    existingEdge.v1.position,
                    existingEdge.v2.position
                )) {
                    return false;
                }
            }
        }

        // Check if triangle normal is consistent with boundary orientation
        const normal = this.calculateTriangleNormal(
            edge.v1.position,
            edge.v2.position,
            vertex.position
        );

        return this.isNormalConsistent(normal, edges);
    }

    private optimizeMeshQuality(triangles: Triangle[], edges: Edge[], quality: number): void {
        // Implement mesh improvement operations:
        // 1. Edge flipping for better triangle quality
        // 2. Vertex smoothing
        // 3. Triangle subdivision if needed
        
        let improved = true;
        const maxIterations = 10;
        let iteration = 0;

        while (improved && iteration < maxIterations) {
            improved = false;
            
            // Edge flipping
            improved = this.improveTrianglesByEdgeFlips(triangles, edges) || improved;
            
            // Vertex smoothing
            improved = this.smoothVertices(triangles, quality) || improved;
            
            iteration++;
        }
    }

    private improveTrianglesByEdgeFlips(triangles: Triangle[], edges: Edge[]): boolean {
        let improved = false;

        for (const edge of edges) {
            if (edge.triangles.length !== 2) continue;

            const [t1, t2] = edge.triangles;
            if (this.shouldFlipEdge(t1, t2)) {
                this.flipEdge(edge, t1, t2);
                improved = true;
            }
        }

        return improved;
    }

    private shouldFlipEdge(t1: Triangle, t2: Triangle): boolean {
        // Implement Delaunay criterion for edge flipping
        // Returns true if flipping the edge would improve mesh quality
        return false; // Placeholder
    }

    private smoothVertices(triangles: Triangle[], quality: number): boolean {
        let improved = false;

        for (const triangle of triangles) {
            for (const vertex of triangle.vertices) {
                const newPosition = this.calculateSmoothPosition(vertex, triangles);
                if (this.isValidMove(vertex, newPosition, triangles, quality)) {
                    vertex.position = newPosition;
                    improved = true;
                }
            }
        }

        return improved;
    }

    private createMeshFromTriangulation(triangles: Triangle[]): Mesh {
        const positions: number[] = [];
        const indices: number[] = [];
        const normals: number[] = [];

        // Create vertex and index buffers from triangulation
        for (const triangle of triangles) {
            for (const vertex of triangle.vertices) {
                positions.push(
                    vertex.position.x,
                    vertex.position.y,
                    vertex.position.z
                );
                normals.push(
                    triangle.normal.x,
                    triangle.normal.y,
                    triangle.normal.z
                );
            }

            indices.push(
                triangle.vertices[0].index,
                triangle.vertices[1].index,
                triangle.vertices[2].index
            );
        }

        const mesh = new Mesh("cuttingSurface", this.scene);
        const vertexData = new VertexData();

        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;

        vertexData.applyToMesh(mesh);
        return mesh;
    }

    // Helper methods
    private calculateTriangleNormal(p1: Vector3, p2: Vector3, p3: Vector3): Vector3 {
        const v1 = p2.subtract(p1);
        const v2 = p3.subtract(p1);
        return Vector3.Cross(v1, v2).normalize();
    }

    private calculateTriangleArea(p1: Vector3, p2: Vector3, p3: Vector3): number {
        const v1 = p2.subtract(p1);
        const v2 = p3.subtract(p1);
        return Vector3.Cross(v1, v2).length() / 2;
    }

    // ... rest of the helper methods for mesh operations

    private performCut(targetMesh: Mesh, cuttingSurface: Mesh): Mesh {
        const targetCSG = CSG.FromMesh(targetMesh);
        const cuttingCSG = CSG.FromMesh(cuttingSurface);
        const resultCSG = targetCSG.subtract(cuttingCSG);

        const resultMesh = resultCSG.toMesh(
            `${targetMesh.name}_cut`,
            targetMesh.material,
            this.scene,
            true
        );

        resultMesh.position = targetMesh.position.clone();
        resultMesh.rotation = targetMesh.rotation.clone();
        resultMesh.scaling = targetMesh.scaling.clone();

        return resultMesh;
    }
    // Previous imports and interfaces remain the same...

// Adding missing helper methods and completing the implementation:

private canAddTriangle(vertices: Vertex[], edges: Edge[]): boolean {
    // Check if we can still form valid triangles
    // We need at least 3 vertices and some edges not part of max triangles
    if (vertices.length < 3) return false;
    
    for (const edge of edges) {
        if (edge.triangles.length < 2) return true;
    }
    
    return false;
}

private edgesIntersect(
    start1: Vector3,
    end1: Vector3,
    start2: Vector3,
    end2: Vector3
): boolean {
    // Convert to 2D for intersection test using the most significant plane
    const points = [start1, end1, start2, end2];
    const normalDir = this.findMostSignificantDirection(points);
    
    // Project points to 2D
    const p1 = this.projectTo2D(start1, normalDir);
    const p2 = this.projectTo2D(end1, normalDir);
    const p3 = this.projectTo2D(start2, normalDir);
    const p4 = this.projectTo2D(end2, normalDir);
    
    // Check if bounding boxes overlap
    if (!this.boundingBoxesOverlap(p1, p2, p3, p4)) return false;
    
    // Check line segments intersection
    return this.lineSegmentsIntersect(p1, p2, p3, p4);
}

private findMostSignificantDirection(points: Vector3[]): Vector3 {
    // Calculate average normal using points
    const normal = new Vector3(0, 0, 0);
    for (let i = 0; i < points.length - 2; i++) {
        const v1 = points[i + 1].subtract(points[i]);
        const v2 = points[i + 2].subtract(points[i]);
        normal.addInPlace(Vector3.Cross(v1, v2));
    }
    normal.normalize();
    
    // Return the axis most aligned with the normal
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    
    if (absX >= absY && absX >= absZ) return new Vector3(1, 0, 0);
    if (absY >= absX && absY >= absZ) return new Vector3(0, 1, 0);
    return new Vector3(0, 0, 1);
}

private projectTo2D(point: Vector3, normalDir: Vector3): { x: number, y: number } {
    if (normalDir.x === 1) {
        return { x: point.y, y: point.z };
    } else if (normalDir.y === 1) {
        return { x: point.x, y: point.z };
    }
    return { x: point.x, y: point.y };
}

private boundingBoxesOverlap(
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number },
    p4: { x: number, y: number }
): boolean {
    const minX1 = Math.min(p1.x, p2.x);
    const maxX1 = Math.max(p1.x, p2.x);
    const minY1 = Math.min(p1.y, p2.y);
    const maxY1 = Math.max(p1.y, p2.y);
    
    const minX2 = Math.min(p3.x, p4.x);
    const maxX2 = Math.max(p3.x, p4.x);
    const minY2 = Math.min(p3.y, p4.y);
    const maxY2 = Math.max(p3.y, p4.y);
    
    return !(maxX1 < minX2 || maxX2 < minX1 || maxY1 < minY2 || maxY2 < minY1);
}

private lineSegmentsIntersect(
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number },
    p4: { x: number, y: number }
): boolean {
    const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denominator === 0) return false;
    
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

private updateDataStructures(triangle: Triangle, edges: Edge[]): void {
    // Add new edges if they don't exist
    for (let i = 0; i < 3; i++) {
        const v1 = triangle.vertices[i];
        const v2 = triangle.vertices[(i + 1) % 3];
        
        let edge = this.findEdge(edges, v1, v2);
        if (!edge) {
            edge = {
                v1: v1,
                v2: v2,
                weight: Vector3.Distance(v1.position, v2.position),
                triangles: []
            };
            edges.push(edge);
            v1.edges.push(edge);
            v2.edges.push(edge);
        }
        
        edge.triangles.push(triangle);
    }
}

private findEdge(edges: Edge[], v1: Vertex, v2: Vertex): Edge | undefined {
    return edges.find(edge => 
        (edge.v1 === v1 && edge.v2 === v2) || 
        (edge.v1 === v2 && edge.v2 === v1)
    );
}

private flipEdge(edge: Edge, t1: Triangle, t2: Triangle): void {
    // Get vertices not shared by the triangles
    const v1 = t1.vertices.find(v => v !== edge.v1 && v !== edge.v2)!;
    const v2 = t2.vertices.find(v => v !== edge.v1 && v !== edge.v2)!;
    
    // Create new triangles
    const newT1 = this.createTriangle(v1, v2, edge.v1);
    const newT2 = this.createTriangle(v1, v2, edge.v2);
    
    // Update edge references
    const edgeIndex1 = t1.vertices.indexOf(edge.v1);
    const edgeIndex2 = t2.vertices.indexOf(edge.v2);
    
    edge.v1 = v1;
    edge.v2 = v2;
    edge.weight = Vector3.Distance(v1.position, v2.position);
    edge.triangles = [newT1, newT2];
    
    // Replace old triangles with new ones
    t1 = newT1;
    t2 = newT2;
}


private calculateSmoothPosition(vertex: Vertex, triangles: Triangle[]): Vector3 {
    // Get all neighbor vertices
    const neighbors = new Set<Vertex>();
    for (const edge of vertex.edges) {
        neighbors.add(edge.v1 === vertex ? edge.v2 : edge.v1);
    }
    
    // Calculate Laplacian smoothing
    const newPosition = new Vector3(0, 0, 0);
    neighbors.forEach(neighbor => {
        newPosition.addInPlace(neighbor.position);
    });
    
    if (neighbors.size > 0) {
        newPosition.scaleInPlace(1 / neighbors.size);
    }
    
    return newPosition;
}

private isValidMove(
    vertex: Vertex,
    newPosition: Vector3,
    triangles: Triangle[],
    quality: number
): boolean {
    // Check if move maintains mesh quality
    const affectedTriangles = triangles.filter(t => 
        t.vertices.includes(vertex)
    );
    
    const oldPosition = vertex.position.clone();
    vertex.position = newPosition;
    
    let isValid = true;
    for (const triangle of affectedTriangles) {
        if (!this.isTriangleQualityAcceptable(triangle, quality)) {
            isValid = false;
            break;
        }
    }
    
    vertex.position = oldPosition;
    return isValid;
}

private isTriangleQualityAcceptable(triangle: Triangle, quality: number): boolean {
    // Check minimum angle
    const angles = this.calculateTriangleAngles(
        triangle.vertices[0].position,
        triangle.vertices[1].position,
        triangle.vertices[2].position
    );
    
    const minAngle = Math.min(...angles);
    return minAngle > quality * Math.PI / 6; // quality * 30 degrees
}

private calculateTriangleAngles(p1: Vector3, p2: Vector3, p3: Vector3): number[] {
    const v1 = p2.subtract(p1);
    const v2 = p3.subtract(p1);
    const v3 = p3.subtract(p2);
    
    const a1 = Math.acos(Vector3.Dot(v1.normalize(), v2.normalize()));
    const a2 = Math.acos(Vector3.Dot(v1.normalize().scale(-1), v3.normalize().scale(-1)));
    const a3 = Math.acos(Vector3.Dot(v2.normalize().scale(-1), v3.normalize()));
    
    return [a1, a2, a3];
}

private isNormalConsistent(normal: Vector3, edges: Edge[]): boolean {
    // Check if the normal is consistent with boundary orientation
    // This is a simplified check - you might want to implement a more robust version
    const boundaryNormal = this.calculateAverageBoundaryNormal(edges);
    return Vector3.Dot(normal, boundaryNormal) > 0;
}

private calculateAverageBoundaryNormal(edges: Edge[]): Vector3 {
    const normal = new Vector3(0, 0, 0);
    let count = 0;
    
    for (let i = 0; i < edges.length - 1; i++) {
        const v1 = edges[i].v2.position.subtract(edges[i].v1.position);
        const v2 = edges[i + 1].v2.position.subtract(edges[i + 1].v1.position);
        normal.addInPlace(Vector3.Cross(v1, v2));
        count++;
    }
    
    if (count > 0) {
        normal.scaleInPlace(1 / count);
    }
    
    return normal.normalize();
}


}