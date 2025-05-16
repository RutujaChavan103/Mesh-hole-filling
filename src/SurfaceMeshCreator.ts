
import * as vtk from '@kitware/vtk.js/vtk';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import { Mesh, Scene, Vector3, VertexData } from '@babylonjs/core';
//import vtkDelaunay3D from '@kitware/vtk.js/Filters/Core/Delaunay3D';
//var triangulate = require("delaunay-triangulate")
import { triangulate } from "delaunay-triangulate";

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface SurfaceData {
    positions: number[];
    indices: number[];
    normals: number[];
}

interface DelaunayOptions {
    tolerance: number;
    alpha: number;
    offset: number;
}

class SurfaceGenerator {
    private defaultOptions: DelaunayOptions = {
        tolerance: 0.001,
        alpha: 0.0,
        offset: 2.5
    };

    constructor(private options: Partial<DelaunayOptions> = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }

    public generateSurfaceFromPoints(points: Vector3[]) : SurfaceData | null {
        //var triangulate = require("delaunay-triangulate")

        const ptsArray =
        points.map(pt => pt.asArray());
        
        var triangles = triangulate(ptsArray);
        
        console.log(triangles)
        return null;
    }

    // public generateSurfaceFromPoints(points: Point3D[]): SurfaceData {
    //     // Create a new instance of vtkPoints
    //     const vtkPoints: any = vtk.Common.DataModel.vtkPoints.newInstance();
        
    //     // Add points to the vtkPoints object
    //     points.forEach(point => {
    //         vtkPoints.insertNextPoint(point.x, point.y, point.z);
    //     });

    //     // Create polydata to store geometry
    //     const polyData: any = vtk.Common.DataModel.vtkPolyData.newInstance();
    //     polyData.setPoints(vtkPoints);

    //     // Create a 3D Delaunay triangulation
    //     const delaunay3D: any = vtk.Filters.Core.vtkDelaunay3D.newInstance();
    //     delaunay3D.setInputData(polyData);
    //     delaunay3D.setTolerance(this.options.tolerance!);
    //     delaunay3D.setAlpha(this.options.alpha!);
    //     delaunay3D.setOffset(this.options.offset!);
        
    //     // Update the filter
    //     delaunay3D.update();

    //     // Get the output
    //     const output = delaunay3D.getOutput();

    //     // Convert VTK surface to Babylon mesh data
    //     const positions: number[] = [];
    //     const indices: number[] = [];
    //     const normals: number[] = [];

    //     // Extract vertices
    //     const numPoints: number = output.getPoints().getNumberOfPoints();
    //     for (let i = 0; i < numPoints; i++) {
    //         const point = output.getPoints().getPoint(i);
    //         positions.push(point[0], point[1], point[2]);
    //     }

    //     // Extract triangles
    //     const cells: number[] = output.getPolys().getData();
    //     for (let i = 0; i < cells.length; i += 4) {
    //         if (cells[i] === 3) { // Only process triangles
    //             indices.push(cells[i + 1], cells[i + 2], cells[i + 3]);
    //         }
    //     }

    //     // Calculate normals
    //     this.calculateNormals(positions, indices, normals);

    //     return {
    //         positions,
    //         indices,
    //         normals
    //     };
    // }

    private calculateNormals(positions: number[], indices: number[], normals: number[]): void {
        // Initialize normals array
        for (let i = 0; i < positions.length; i++) {
            normals[i] = 0;
        }

        // Calculate normals for each triangle
        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3;
            const i2 = indices[i + 1] * 3;
            const i3 = indices[i + 2] * 3;

            // Get triangle vertices
            const v1: [number, number, number] = [
                positions[i1],
                positions[i1 + 1],
                positions[i1 + 2]
            ];
            const v2: [number, number, number] = [
                positions[i2],
                positions[i2 + 1],
                positions[i2 + 2]
            ];
            const v3: [number, number, number] = [
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2]
            ];

            // Calculate triangle normal
            const normal = this.calculateTriangleNormal(v1, v2, v3);

            // Add normal to all vertices of the triangle
            for (let j = 0; j < 3; j++) {
                normals[i1 + j] += normal[j];
                normals[i2 + j] += normal[j];
                normals[i3 + j] += normal[j];
            }
        }

        // Normalize all normals
        for (let i = 0; i < normals.length; i += 3) {
            const length = Math.sqrt(
                normals[i] * normals[i] +
                normals[i + 1] * normals[i + 1] +
                normals[i + 2] * normals[i + 2]
            );

            if (length > 0) {
                normals[i] /= length;
                normals[i + 1] /= length;
                normals[i + 2] /= length;
            }
        }
    }

    private calculateTriangleNormal(
        v1: [number, number, number],
        v2: [number, number, number],
        v3: [number, number, number]
    ): [number, number, number] {
        // Calculate vectors
        const vec1: [number, number, number] = [
            v2[0] - v1[0],
            v2[1] - v1[1],
            v2[2] - v1[2]
        ];
        const vec2: [number, number, number] = [
            v3[0] - v1[0],
            v3[1] - v1[1],
            v3[2] - v1[2]
        ];

        // Calculate cross product
        return [
            vec1[1] * vec2[2] - vec1[2] * vec2[1],
            vec1[2] * vec2[0] - vec1[0] * vec2[2],
            vec1[0] * vec2[1] - vec1[1] * vec2[0]
        ];
    }
}

export class SurfaceMeshCreator {
    public static createSurfaceMesh(
        scene: Scene,
        points: Vector3[],
        options?: Partial<DelaunayOptions>
    ): Mesh {
        const generator = new SurfaceGenerator(options);
        const surfaceData = generator.generateSurfaceFromPoints(points);
        if(!surfaceData) {
            console.log("Surface not generated properly.");
            return scene.meshes[0] as Mesh;
        }
        
        const customMesh = new Mesh("surface", scene);
        const vertexData = new VertexData();
        
        vertexData.positions = surfaceData.positions;
        vertexData.indices = surfaceData.indices;
        vertexData.normals = surfaceData.normals;
        
        vertexData.applyToMesh(customMesh);
        
        return customMesh;
    }
}