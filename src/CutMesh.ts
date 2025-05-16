import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import { MeshBuilder } from "@babylonjs/core";
import { CSG } from "@babylonjs/core";


export default function cutMesh(scene:Scene, targetMesh: Mesh, cuttingPoints: Vector3[]) {
    if (!targetMesh || cuttingPoints.length < 2) return;

    // Create cutting plane from points
    const direction = cuttingPoints[1].subtract(cuttingPoints[0]).normalize();
    const normal = Vector3.Cross(direction, Vector3.Up()).normalize();
    
    // Create a thin box as cutting tool
    const width = targetMesh.getBoundingInfo().boundingBox.extendSize.x * 2;
    const height = targetMesh.getBoundingInfo().boundingBox.extendSize.y * 2;
    const cuttingBox = MeshBuilder.CreateBox("cutter", {
        width: width,
        height: height,
        depth: 0.1
    }, scene);

    // Position cutting box
    cuttingBox.position = cuttingPoints[0];
    cuttingBox.lookAt(cuttingPoints[1]);

    // Perform CSG operations
    const targetCSG = CSG.FromMesh(targetMesh);
    const cutterCSG = CSG.FromMesh(cuttingBox);
    
    // Create two parts from the cut
    const part1 = targetCSG.subtract(cutterCSG);
    const part2 = targetCSG.intersect(cutterCSG);

    // Convert back to meshes
    const resultMesh1 = part1.toMesh("part1", targetMesh.material, scene);
    const resultMesh2 = part2.toMesh("part2", targetMesh.material, scene);

    // Clean up
    targetMesh.dispose();
    cuttingBox.dispose();

    return [resultMesh1, resultMesh2];
}