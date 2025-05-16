import { Mesh, Vector3, DataBuffer, VertexBuffer, MeshBuilder, StandardMaterial, Color3, Scene, VertexData } from "@babylonjs/core";
import { Triangle } from "./aabb/Triangle";
import { ProjectedPoint } from "MeshSplit";

function createDebugMesh(triangle: Triangle, scene: Scene, color: Color3): Mesh {
    // Create vertices array for the debug triangle
    const vertices = [
        triangle.v1.x, triangle.v1.y, triangle.v1.z,
        triangle.v2.x, triangle.v2.y, triangle.v2.z,
        triangle.v3.x, triangle.v3.y, triangle.v3.z,
    ];
    
    // Create a custom mesh for the triangle
    const debugMesh = new Mesh("debugTriangle", scene);
    const positions = new Float32Array(vertices);
    const indices = new Uint32Array([0, 1, 2]);
    
    debugMesh.setVerticesData(VertexBuffer.PositionKind, positions);
    debugMesh.setIndices(indices);

    // Create and assign material
    const material = new StandardMaterial("debugMaterial", scene);
    material.emissiveColor = color;
    material.backFaceCulling = false;
    debugMesh.material = material;

    return debugMesh;
}

function splitTriangle(mesh: Mesh, triangleId: number, splitPoint: Vector3): Triangle[] {
    // Get the vertices of the original triangle
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    
    if (!positions || !indices) {
        throw new Error('Mesh does not have position or index data');
    }

    // Get the three vertex indices for this triangle
    const index1 = indices[triangleId * 3];
    const index2 = indices[triangleId * 3 + 1];
    const index3 = indices[triangleId * 3 + 2];

    // Get the vertex positions
    const v1 = new Vector3(
        positions[index1 * 3],
        positions[index1 * 3 + 1],
        positions[index1 * 3 + 2]
    );
    const v2 = new Vector3(
        positions[index2 * 3],
        positions[index2 * 3 + 1],
        positions[index2 * 3 + 2]
    );
    const v3 = new Vector3(
        positions[index3 * 3],
        positions[index3 * 3 + 1],
        positions[index3 * 3 + 2]
    );

    // Create three new triangles using the split point
    const newTriangles: Triangle[] = [
        new Triangle(v1, v2, splitPoint, triangleId),
        new Triangle(v2, v3, splitPoint, triangleId),
        new Triangle(v3, v1, splitPoint, triangleId)
    ];

    return newTriangles;
}

function updateMeshWithSplitTriangles(
    mesh: Mesh, 
    triangleId: number, 
    newTriangles: Triangle[],
    projectedPoint: ProjectedPoint
): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    
    if (!positions || !indices) {
        throw new Error('Mesh does not have position or index data');
    }

    // Create new arrays for the updated mesh data
    const newPositions = [...positions];
    const newIndices = [...indices];

    // Add the new split point to positions
    const splitPointIndex = positions.length / 3;
    newPositions.push(
        newTriangles[0].v3.x,
        newTriangles[0].v3.y,
        newTriangles[0].v3.z
    );

    projectedPoint.vertexIndex = splitPointIndex;
    // Replace the original triangle indices with the first new triangle
    newIndices[triangleId * 3] = indices[triangleId * 3];     // v1
    newIndices[triangleId * 3 + 1] = indices[triangleId * 3 + 1]; // v2
    newIndices[triangleId * 3 + 2] = splitPointIndex;         // split point

    // Add indices for the second and third triangles
    const startIndex = newIndices.length;
    newIndices.push(
        indices[triangleId * 3 + 1],  // v2
        indices[triangleId * 3 + 2],  // v3
        splitPointIndex,              // split point
        
        indices[triangleId * 3 + 2],  // v3
        indices[triangleId * 3],      // v1
        splitPointIndex               // split point
    );

    // Get existing normals
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    if (!normals) {
        throw new Error('Mesh does not have normal data');
    }
    
    // Create new normals array
    const newNormals = [...normals];
    
    // Add normal for the split point (average of the three triangle normals)
    const normal1 = Vector3.Cross(
        newTriangles[0].v2.subtract(newTriangles[0].v1),
        newTriangles[0].v3.subtract(newTriangles[0].v1)
    ).normalize();
    const normal2 = Vector3.Cross(
        newTriangles[1].v2.subtract(newTriangles[1].v1),
        newTriangles[1].v3.subtract(newTriangles[1].v1)
    ).normalize();
    const normal3 = Vector3.Cross(
        newTriangles[2].v2.subtract(newTriangles[2].v1),
        newTriangles[2].v3.subtract(newTriangles[2].v1)
    ).normalize();
    
    const avgNormal = normal1.add(normal2).add(normal3).scale(1/3).normalize();
    
    // Add the new normal for the split point
    newNormals.push(avgNormal.x, avgNormal.y, avgNormal.z);
    
    // Update the mesh with new normal data
    mesh.setVerticesData(VertexBuffer.NormalKind, newNormals);

    // Update the mesh with new position and index data
    mesh.setVerticesData(VertexBuffer.PositionKind, newPositions);
    mesh.setIndices(newIndices);
}

// Example usage:
export function splitMeshTriangle(mesh: Mesh, triangleId: number, projectedPoint: ProjectedPoint): void {
    const newTriangles = splitTriangle(mesh, triangleId, projectedPoint.point);
    updateMeshWithSplitTriangles(mesh, triangleId, newTriangles, projectedPoint);

    return ;
    // Debug visualization
    const scene = mesh.getScene();
    
    // Visualize the split point
    const splitPointSphere = MeshBuilder.CreateSphere("splitPoint", { diameter: 0.1 }, scene);
    splitPointSphere.position = splitPoint;
    const sphereMat = new StandardMaterial("splitPointMat", scene);
    sphereMat.emissiveColor = new Color3(1, 0, 0); // Red
    splitPointSphere.material = sphereMat;

    // Visualize each new triangle with different colors
    const colors = [
        new Color3(1, 0, 0),   // Red
        new Color3(0, 1, 0),   // Green
        new Color3(0, 0, 1)    // Blue
    ];

    newTriangles.forEach((triangle, index) => {
        createDebugMesh(triangle, scene, colors[index]);
    });
}
