import {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    MeshBuilder,
    Color3,
    StandardMaterial,
    PointerEventTypes,
    SceneLoader
} from "@babylonjs/core";

import '@babylonjs/loaders';
import * as BABYLON from '@babylonjs/core';
import { STLExport } from 'babylonjs-serializers';
import { CSG } from "@babylonjs/core";
// import STLSerializers from 'babylonjs-serializers';

// const { STLExport } = STLSerializers;
//import cutMesh from './CutMesh'
//import { MeshCutter} from './MeshCutter'
import earcut from 'earcut';
import { MeshSplit } from './MeshSplit'
import { loadPoints, preloadMesh } from './preload'
import { zoomAll } from './zoomAll'

export var store = {
    scene: null,
    engine: null,
    canvas: null,
    isDrawing: false,
    currentMesh: null,
    points: [],
    lines: null
}

window.store = store;

// Initialize global variables
let canvas, engine, scene;
let isDrawing = false;
let currentMesh = null;
let lines = null;

const createScene = function () {
    const scene = new Scene(engine);

    // Camera
    const camera = new ArcRotateCamera("camera",
        0, Math.PI / 3, 10,
        Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);
    camera.panningSensibility = 100;

    // Light
    const light = new HemisphericLight("light",
        new Vector3(0, 1, 0),
        scene
    );

    // Ground for reference
    // const ground = MeshBuilder.CreateGround("ground", 
    //     {width: 6, height: 6}, 
    //     scene
    // );
    // ground.position.y = -1;

    // const groundMaterial = new StandardMaterial("groundMaterial", scene);

    // // Use grey color
    // groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
    // ground.material = groundMaterial;

    return scene;
};

const initializeApp = () => {
    if (typeof window === 'undefined') return;

    canvas = document.getElementById("renderCanvas");
    engine = new Engine(canvas, true);
    scene = createScene();
    store.scene = scene;
    store.engine = engine;
    store.canvas = canvas;
    //store.points = points;

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });

    setupEventListeners();
};

const setupEventListeners = () => {
    if (typeof window === 'undefined') return;

    const fileInput = document.getElementById('fileInput');
    const drawButton = document.getElementById('drawButton');
    const fileStatus = document.getElementById('fileStatus');
    const statusText = document.querySelector('.status-text');

    fileInput?.addEventListener('change', async (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            // fileStatus.textContent = `Loading: ${file.name}`;
            // statusText.textContent = 'Loading model...';

            try {
                await handleFileUpload(event);
                // fileStatus.textContent = `Loaded: ${file.name}`;
                // statusText.textContent = 'Model loaded successfully';
            } catch (error) {
                console.log("Error loading file: ", error.message);
                // fileStatus.textContent = `Error loading file: ${error.message}`;
                // statusText.textContent = 'Error loading model';
            }
        }
    });

    // Remove drawButton event listener and add keypress event
    window.addEventListener('keypress', (event) => {
        if (event.key.toLowerCase() === 'a' && isDrawing) {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY);

            if (!pickResult.hit || !pickResult.pickedMesh) return;

            // Offset distance
            const offsetDistance = 0.3;

            // Compute the offset point
            const pickedPoint = pickResult.pickedPoint.clone();
            const faceId = pickResult.faceId;

            if (faceId !== undefined) {
                const mesh = pickResult.pickedMesh;
        const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);

        // Get the normal of the picked triangle (average of its vertices' normals)
        const indices = mesh.getIndices();
        const normal1 = BABYLON.Vector3.FromArray(normals, indices[faceId * 3] * 3);
        const normal2 = BABYLON.Vector3.FromArray(normals, indices[faceId * 3 + 1] * 3);
        const normal3 = BABYLON.Vector3.FromArray(normals, indices[faceId * 3 + 2] * 3);
        const normal = normal1.add(normal2).add(normal3).normalize();

        // Offset the picked point in the direction of the normal
        pickedPoint.addInPlace(normal.scale(offsetDistance));
            }

            const points = store.points;
            // Add the offset point to the points array
            points.push(pickedPoint);

            // Dispose of the previous lines if they exist
            if (lines) {
                lines.dispose();
            }

            // Create new lines if there are at least two points
            if (points.length > 1) {
                lines = BABYLON.MeshBuilder.CreateLines("lines", {
                    points: points,
                    updatable: true
                }, scene);
                lines.color = new BABYLON.Color3(1, 0, 0);
                //lines.renderingGroupId = 2;
            }

        }
    });

    // Remove the pointer observable since we're using keypress now
    //scene.onPointerObservable.remove(handlePointerEvent);

    drawButton?.addEventListener('click', () => {
        isDrawing = !isDrawing;

        if(isDrawing){
            drawButton.classList.add('active');
        }else{
            drawButton.classList.remove('active');
        }
    });

    window.addEventListener('keypress', (event) => {
        if (event.key.toLowerCase() === 'c' && isDrawing) {
            clearDrawing();
        }
    });

    const preloadButton = document.getElementById('preloadButton');

    preloadButton.addEventListener('click', async () => {
        //const stlUrl = new URL('../assets/3_sample.stl', import.meta.url).href;
        const stlUrl = new URL('../assets/Cool_Snaget.stl', import.meta.url).href;
        console.log("Resolved STL URL:", stlUrl);
        await preloadMesh(stlUrl, scene);
        loadPoints(store);

        createLines(store.points);
    });
};

const handleFileUpload = async (event) => {
    if (!event.target.files.length) return;

    const file = event.target.files[0];
    console.log("File selected:", file.name);

    try {
        // Clear the existing mesh if it exists
        if (currentMesh) {
            currentMesh.dispose();
        }

        // Create a FileReader to read the file as an ArrayBuffer
        const reader = new FileReader();

        reader.onload = function (e) {
            const arrayBuffer = e.target.result;  // This is the ArrayBuffer

            const assetBlob = new Blob([arrayBuffer]);
            const assetUrl = URL.createObjectURL(assetBlob);

            BABYLON.appendSceneAsync(assetUrl, scene, {
                pluginExtension: '.stl'
            }).then(() => {
                console.log("Mesh loaded successfully");
                zoomAll(scene); // Call zoomAll after the mesh is loaded
            });
        };

        // Read the STL file as an ArrayBuffer
        reader.readAsArrayBuffer(file);

    } catch (error) {
        console.error("Error loading STL:", error);
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = 'Error loading model';
        }
    }
};

const createLines = (points) => {
    if (lines) {
        lines.dispose();
    }

    if (points.length > 1) {
        lines = MeshBuilder.CreateLines("lines", {
            points: points,
            updatable: true
        }, scene);
        lines.color = new Color3(1, 0, 0);
    }
}

const handlePointerEvent = (pointerInfo) => {
    if (!isDrawing) return;

    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN)
        return;

    const points = store.points;
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedMesh) {
        points.push(pickResult.pickedPoint);

        if (lines) {
            lines.dispose();
        }
        if (points.length > 1) {
            lines = MeshBuilder.CreateLines("lines", {
                points: points,
                updatable: true
            }, scene);
            lines.color = new Color3(1, 0, 0);
        }
    }
};

const clearDrawing = () => {
    //points = [];
    store.points = [];
    if (lines) {
        lines.dispose();
        lines = null;
    }
};


const detectBoundaryEdges = (mesh) => {
    if (!mesh) return;

    // Remove any previous boundary lines
    if (mesh.boundaryLines) {
        mesh.boundaryLines.dispose();
        mesh.boundaryLines = null;
    }

    // Get boundary edges
    const boundaryEdges = getMeshBoundaryEdges(mesh);

    // Draw boundary edges as lines
    const lines = [];
    boundaryEdges.forEach(edge => {
        lines.push([edge.p0, edge.p1]);
    });

    if (lines.length > 0) {
        mesh.boundaryLines = BABYLON.MeshBuilder.CreateLineSystem(
            "boundaryLines",
            { lines: lines, updatable: true },
            mesh.getScene()
        );
        
        mesh.boundaryLines.color = new BABYLON.Color3(1, 0, 0); // Red
    }

    console.log(`Boundary edges rendered for: ${mesh.name}`);
}; 


// Weld duplicate vertices in the mesh (for STL and similar imports)
function weldMeshVertices(mesh, tolerance = 1e-6) {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const vertexMap = new Map();
    const newPositions = [];
    const newIndices = [];
    let newIndex = 0;

    function vertexKey(x, y, z) {
        return [
            Math.round(x / tolerance),
            Math.round(y / tolerance),
            Math.round(z / tolerance)
        ].join(",");
    }

    // Map old vertex indices to new indices
    for (let i = 0; i < positions.length; i += 3) {
        const key = vertexKey(positions[i], positions[i+1], positions[i+2]);
        if (!vertexMap.has(key)) {
            vertexMap.set(key, newIndex);
            newPositions.push(positions[i], positions[i+1], positions[i+2]);
            newIndex++;
        }
    }

    // Build new indices referencing welded vertices
    for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const key = vertexKey(
            positions[idx * 3],
            positions[idx * 3 + 1],
            positions[idx * 3 + 2]
        );
        newIndices.push(vertexMap.get(key));
    }

    // Create new mesh with welded vertices
    const newMesh = new BABYLON.Mesh(mesh.name + "_welded", mesh.getScene());
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = newPositions;
    vertexData.indices = newIndices;
    vertexData.applyToMesh(newMesh);
    newMesh.material = mesh.material;
    newMesh.position = mesh.position.clone();
    newMesh.rotation = mesh.rotation.clone();
    newMesh.scaling = mesh.scaling.clone();

    // Optionally, dispose the old mesh
    // mesh.dispose();

    return newMesh;
}

// Get the boundary edges of the mesh
function getMeshBoundaryEdges(mesh) {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const edges = [];
    const edgeMap = new Map();

    // Loop through all edges and find boundary edges
    for (let i = 0; i < indices.length; i += 3) {
        const v0 = indices[i];
        const v1 = indices[i + 1];
        const v2 = indices[i + 2];

        const edgesInFace = [
            [v0, v1],
            [v1, v2],
            [v2, v0],
        ];

        // Store edges in a map (undirected edges)
        edgesInFace.forEach(edge => {
            //const sortedEdge = edge.sort((a, b) => a - b);
            const sortedEdge = [Math.min(edge[0], edge[1]), Math.max(edge[0], edge[1])];
            const edgeKey = sortedEdge.join('-');
            if (edgeMap.has(edgeKey)) {
                edgeMap.set(edgeKey, edgeMap.get(edgeKey) + 1);
            } else {
                edgeMap.set(edgeKey, 1);
            }
        });
    }

    // Boundary edges appear only once
    edgeMap.forEach((count, edgeKey) => {
        if (count === 1) {
            const [v0, v1] = edgeKey.split('-').map(Number);
            const p0 = new BABYLON.Vector3(positions[v0 * 3], positions[v0 * 3 + 1], positions[v0 * 3 + 2]);
            const p1 = new BABYLON.Vector3(positions[v1 * 3], positions[v1 * 3 + 1], positions[v1 * 3 + 2]);

            edges.push({ p0, p1 });
        }
    });

    return edges;
}

// Function to fill hole based on hole size (Centroid Fan, Projection with Earcut, or Advancing Front)
function fillHole(mesh) {
    const boundaryEdges = getMeshBoundaryEdges(mesh);
    const loops = groupEdgesIntoLoops(boundaryEdges);

    console.log("Number of holes found:", loops.length);
    loops.forEach((loop, i) => {
        console.log(`Hole ${i+1} has ${loop.length} vertices`);
    });

    loops.forEach(loop => {
        // Convert loop (array of vertices) to array of edges
        const edges = loopToEdges(loop);
        if (edges.length <= 6) {
            console.log("Using Centroid Fan method for hole filling (loop)...");
            centroidFanFill(mesh, edges);
        } else if (edges.length <= 50) {
            console.log("Using Projection with Earcut method for hole filling (loop)...");
            projectionEarcutFill(mesh, edges);
        } else {
            console.log("Using Improved Advancing Front method for hole filling (loop)...");
            improvedAdvancingFrontFill(mesh, edges);
        }
    });
}


// Helper: convert ordered loop of vertices to edge objects
function loopToEdges(loop) {
    const edges = [];
    for (let i = 0; i < loop.length; i++) {
        edges.push({ p0: loop[i], p1: loop[(i + 1) % loop.length] });
    }
    return edges;
}

function groupEdgesIntoLoops(edges) {
    const edgeMap = new Map();
    edges.forEach(({ p0, p1 }) => {
        const k0 = p0.toString();
        const k1 = p1.toString();
        if (!edgeMap.has(k0)) edgeMap.set(k0, []);
        if (!edgeMap.has(k1)) edgeMap.set(k1, []);
        edgeMap.get(k0).push(p1);
        edgeMap.get(k1).push(p0);
    });

    const loops = [];
    const visited = new Set();

    edges.forEach(({ p0 }) => {
        const key = p0.toString();
        if (visited.has(key)) return;

        const loop = [];
        let current = p0;
        let prev = null;
        while (current && !visited.has(current.toString())) {
            loop.push(current);
            visited.add(current.toString());
            const neighbors = edgeMap.get(current.toString()) || [];
            let next = neighbors.find(v => !prev || !v.equals(prev));
            if (!next || visited.has(next.toString())) break;
            prev = current;
            current = next;
        }
        if (loop.length > 2) loops.push(loop);
    });

    return loops;
}

// Utility to order boundary vertices in a connected loop
function orderBoundaryVertices(boundaryEdges) {
    if (boundaryEdges.length === 0) return [];
    const adjacency = new Map();
    boundaryEdges.forEach(edge => {
        const k0 = edge.p0.toString();
        const k1 = edge.p1.toString();
        if (!adjacency.has(k0)) adjacency.set(k0, []);
        if (!adjacency.has(k1)) adjacency.set(k1, []);
        adjacency.get(k0).push(edge.p1);
        adjacency.get(k1).push(edge.p0);
    });
    let start = boundaryEdges[0].p0;
    const ordered = [start];
    let prev = null;
    let curr = start;
    while (ordered.length < boundaryEdges.length) {
        const neighbors = adjacency.get(curr.toString());
        let next = neighbors.find(v => !prev || !v.equals(prev));
        if (!next || ordered.some(v => v.equals(next))) break;
        ordered.push(next);
        prev = curr;
        curr = next;
    }
    return ordered;
}

// Centroid Fan Hole Filling Method (For holes with ≤6 boundary edges)
function centroidFanFill(mesh, boundaryEdges) {
    let orderedVertices = orderBoundaryVertices(boundaryEdges);
    const centroid = calculateCentroid(boundaryEdges);

    // Reverse the order to ensure correct face normal
    orderedVertices = orderedVertices.reverse();

    // Build positions array
    const positions = [];
    orderedVertices.forEach(v => positions.push(v.x, v.y, v.z));
    positions.push(centroid.x, centroid.y, centroid.z);

    // Build triangle indices for fan
    const centroidIndex = orderedVertices.length;
    const indices = [];
    for (let i = 0; i < orderedVertices.length; i++) {
        indices.push(i, (i + 1) % orderedVertices.length, centroidIndex);
    }

    // Create new mesh
    const newMesh = new BABYLON.Mesh("holeFillMesh", store.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    store.scene.meshes.push(newMesh);
}

// Calculate the centroid of the boundary vertices
function calculateCentroid(boundaryEdges) {
    let sumX = 0, sumY = 0, sumZ = 0;
    boundaryEdges.forEach(edge => {
        sumX += edge.p0.x;
        sumY += edge.p0.y;
        sumZ += edge.p0.z;
    });
    const numVertices = boundaryEdges.length;
    return new BABYLON.Vector3(sumX / numVertices, sumY / numVertices, sumZ / numVertices);
}

// Projection with Earcut Hole Filling Method (For holes with 7-50 boundary edges)
function projectionEarcutFill(mesh, boundaryEdges) {
    // 1. Order the boundary vertices
    let orderedVertices = orderBoundaryVertices(boundaryEdges);

    // Deduplicate vertices to avoid degenerate triangles
    orderedVertices = deduplicateVertices(orderedVertices);

    // Debug: Check for duplicate/close vertices in boundary
    console.log('Ordered boundary vertices:', orderedVertices.map(v => v.toString()));
    for (let i = 0; i < orderedVertices.length; i++) {
        for (let j = i + 1; j < orderedVertices.length; j++) {
            if (orderedVertices[i].subtract(orderedVertices[j]).length() < 1e-6) {
                console.warn('Duplicate or nearly coincident vertices:', i, j, orderedVertices[i], orderedVertices[j]);
            }
        }
    }

    // Remove last vertex if it matches the first
    if (orderedVertices.length > 2 && orderedVertices[0].subtract(orderedVertices[orderedVertices.length - 1]).length() < 1e-6) {
        orderedVertices.pop();
    }

    // Reverse for correct normal direction
    orderedVertices = orderedVertices.reverse();

    // 2. Project to best-fit plane
    const points2DArray = projectToBestFitPlane(orderedVertices);
    const points2D = points2DArray.flat();

    // 3. Triangulate
    const triangles = earcut(points2D);

    // Debug: Log points and triangles
    console.log('Earcut 2D points:', points2DArray);
    console.log('Earcut triangles:', triangles);

    // Log each triangle and check for degeneracy
    for (let i = 0; i < triangles.length; i += 3) {
        const ia = triangles[i], ib = triangles[i+1], ic = triangles[i+2];
        const a = orderedVertices[ia];
        const b = orderedVertices[ib];
        const c = orderedVertices[ic];
        console.log(`Triangle ${i/3}: indices [${ia}, ${ib}, ${ic}]`, a, b, c);
        if (ia === ib || ib === ic || ic === ia) {
            console.warn('Degenerate triangle (repeated indices):', ia, ib, ic);
        }
        if (BABYLON.Vector3.Cross(b.subtract(a), c.subtract(a)).length() < 1e-8) {
            console.warn('Colinear triangle detected:', ia, ib, ic);
        }
    }
    // Log which boundary indices are unused
    const usedIndices = new Set(triangles);
    console.log('Boundary indices:', Array.from({length: orderedVertices.length}, (_, i) => i));
    console.log('Used indices in triangles:', Array.from(usedIndices));
    const unused = [];
    for (let i = 0; i < orderedVertices.length; i++) {
        if (!usedIndices.has(i)) unused.push(i);
    }
    console.log('Unused boundary indices:', unused);

    // If earcut leaves a missing triangle, try to patch with centroid or fan
    if (triangles.length < orderedVertices.length - 2) {
        console.warn('Earcut failed to fill completely, attempting to patch with centroid triangle/fan');
        // Find which vertices are not used in any triangle
        const used = new Set(triangles);
        const unused = [];
        for (let i = 0; i < orderedVertices.length; i++) {
            if (!used.has(i)) unused.push(i);
        }
        if (unused.length === 3) {
            // Add the missing triangle
            triangles.push(unused[0], unused[1], unused[2]);
            console.log('Patched missing triangle with indices:', unused);
        } else {
            // Fallback: use centroid fan for the remaining gap
            centroidFanFill(mesh, boundaryEdges);
            return;
        }
    }

    // 4. Build positions and indices for the new mesh
    const positions = [];
    orderedVertices.forEach(v => positions.push(v.x, v.y, v.z));
    const indices = triangles;

    // 5. Create the new mesh
    const newMesh = new BABYLON.Mesh("holeFillMesh", store.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    store.scene.meshes.push(newMesh);
}

// Advancing Front Fill (fallback for problematic holes)
function advancingFrontFill(mesh, boundaryEdges) {
    // Convert ordered edges to unique vertices
    let vertices = orderBoundaryVertices(boundaryEdges).slice();
    vertices = deduplicateVertices(vertices);

    const triangles = [];
    let maxIterations = vertices.length * 2; // Safety

    while (vertices.length > 3 && maxIterations-- > 0) {
        let found = false;
        for (let i = 0; i < vertices.length; i++) {
            const a = vertices[(i + vertices.length - 1) % vertices.length];
            const b = vertices[i];
            const c = vertices[(i + 1) % vertices.length];
            // Check if triangle (a, b, c) is valid (not degenerate, no other vertex inside)
            if (!isTriangleDegenerate(a, b, c) && !anyVertexInTriangle(vertices, a, b, c, i)) {
                triangles.push([a, b, c]);
                vertices.splice(i, 1); // Remove b
                found = true;
                break;
            }
        }
        if (!found) break; // No ear found, exit
    }
    // Final triangle
    if (vertices.length === 3) {
        triangles.push([vertices[0], vertices[1], vertices[2]]);
    }

    // Build mesh (positions, indices)
    const positions = [];
    const indices = [];
    const vertMap = new Map();
    let idx = 0;
    function getIndex(v) {
        const key = v.x + ',' + v.y + ',' + v.z;
        if (!vertMap.has(key)) {
            vertMap.set(key, idx++);
            positions.push(v.x, v.y, v.z);
        }
        return vertMap.get(key);
    }
    triangles.forEach(tri => {
        indices.push(getIndex(tri[0]), getIndex(tri[1]), getIndex(tri[2]));
    });

    const newMesh = new BABYLON.Mesh("holeFillAdvancingFront", store.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    store.scene.meshes.push(newMesh);
}

// Helper: Check if triangle is degenerate (area is close to zero)
function isTriangleDegenerate(a, b, c, tol = 1e-8) {
    const ab = b.subtract(a);
    const ac = c.subtract(a);
    return BABYLON.Vector3.Cross(ab, ac).length() < tol;
}

// Helper: Check if any other vertex is inside triangle (a, b, c)
function anyVertexInTriangle(vertices, a, b, c, skipIndex) {
    for (let i = 0; i < vertices.length; i++) {
        if (i === skipIndex || vertices[i].equals(a) || vertices[i].equals(b) || vertices[i].equals(c)) continue;
        if (pointInTriangle(vertices[i], a, b, c)) return true;
    }
    return false;
}

// Helper: 3D point-in-triangle test (project to best-fit plane first)
function pointInTriangle(p, a, b, c) {
    // Project to plane of triangle
    const normal = BABYLON.Vector3.Cross(b.subtract(a), c.subtract(a)).normalize();
    const proj = v => {
        const d = BABYLON.Vector3.Dot(v.subtract(a), normal);
        return v.subtract(normal.scale(d));
    };
    const pa = proj(a), pb = proj(b), pc = proj(c), pp = proj(p);
    // 2D barycentric test
    const v0 = pb.subtract(pa), v1 = pc.subtract(pa), v2 = pp.subtract(pa);
    const d00 = BABYLON.Vector3.Dot(v0, v0);
    const d01 = BABYLON.Vector3.Dot(v0, v1);
    const d11 = BABYLON.Vector3.Dot(v1, v1);
    const d20 = BABYLON.Vector3.Dot(v2, v0);
    const d21 = BABYLON.Vector3.Dot(v2, v1);
    const denom = d00 * d11 - d01 * d01;
    if (Math.abs(denom) < 1e-8) return false;
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;
    return u >= -1e-8 && v >= -1e-8 && w >= -1e-8;
}


// Remove duplicate/close vertices in a loop
function deduplicateVertices(vertices, tolerance = 1e-6) {
    const unique = [];
    vertices.forEach(v => {
        if (!unique.some(u => v.subtract(u).length() < tolerance)) {
            unique.push(v);
        }
    });
    return unique;
}

// Robust projection of 3D points to best-fit 2D plane
function projectToBestFitPlane(vertices) {
    // Compute centroid
    let cx = 0, cy = 0, cz = 0;
    vertices.forEach(v => { cx += v.x; cy += v.y; cz += v.z; });
    cx /= vertices.length; cy /= vertices.length; cz /= vertices.length;
    // Compute covariance matrix (not used for eigenvector here, but for tangent/bitangent)
    // Find normal (approximate as cross product of two edges)
    let normal = BABYLON.Vector3.Cross(
        vertices[1].subtract(vertices[0]),
        vertices[2].subtract(vertices[0])
    ).normalize();
    // Create two orthogonal vectors in the plane
    let tangent = BABYLON.Vector3.Cross(normal, BABYLON.Axis.X);
    if (tangent.length() < 1e-6)
        tangent = BABYLON.Vector3.Cross(normal, BABYLON.Axis.Y);
    tangent = tangent.normalize();
    const bitangent = BABYLON.Vector3.Cross(normal, tangent);
    // Project each vertex to 2D
    return vertices.map(v => {
        const p = new BABYLON.Vector3(v.x - cx, v.y - cy, v.z - cz);
        return [
            BABYLON.Vector3.Dot(p, tangent),
            BABYLON.Vector3.Dot(p, bitangent)
        ];
    });
}


// Create mesh from triangulated points
function createMeshFromTriangles(triangles, boundaryEdges) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i < triangles.length; i++) {
        const vertex = boundaryEdges[triangles[i]];
        vertices.push(vertex.p0.x, vertex.p0.y, vertex.p0.z);
    }

    for (let i = 0; i < triangles.length; i += 3) {
        indices.push(i, i + 1, i + 2);
    }

    const newMesh = new BABYLON.Mesh("newHoleMesh", store.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = vertices;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    return newMesh;
}

// Improved Advancing Front Hole Filling Method (For holes with >50 boundary edges)
// Improved Advancing Front Hole Filling (Ear Clipping) per MDPI paper
function improvedAdvancingFrontFill(mesh, boundaryEdges) {
    let vertices = orderBoundaryVertices(boundaryEdges).slice();
    vertices = deduplicateVertices(vertices);

    const triangles = [];
    let maxIterations = vertices.length * 2; // Safety

    function angleAt(i) {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length];
        const curr = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        const v1 = prev.subtract(curr).normalize();
        const v2 = next.subtract(curr).normalize();
        let dot = BABYLON.Vector3.Dot(v1, v2);
        dot = Math.max(-1, Math.min(1, dot));
        return Math.acos(dot);
    }

    function isEar(i) {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length];
        const curr = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        if (isTriangleDegenerate(prev, curr, next)) return false;
        for (let j = 0; j < vertices.length; j++) {
            if (j === i || j === (i - 1 + vertices.length) % vertices.length || j === (i + 1) % vertices.length) continue;
            if (pointInTriangle(vertices[j], prev, curr, next)) return false;
        }
        return true;
    }

    while (vertices.length > 3 && maxIterations-- > 0) {
        let minAngle = Infinity;
        let earIndex = -1;
        for (let i = 0; i < vertices.length; i++) {
            const angle = angleAt(i);
            if (angle < minAngle && isEar(i)) {
                minAngle = angle;
                earIndex = i;
            }
        }
        if (earIndex === -1) break;
        const prev = (earIndex - 1 + vertices.length) % vertices.length;
        const next = (earIndex + 1) % vertices.length;
        triangles.push(vertices[prev], vertices[earIndex], vertices[next]);
        vertices.splice(earIndex, 1);
    }
    if (vertices.length === 3) {
        triangles.push(vertices[0], vertices[1], vertices[2]);
    }

    const positions = [];
    const indices = [];
    const vertMap = new Map();
    let idx = 0;
    function getIndex(v) {
        const key = v.x + ',' + v.y + ',' + v.z;
        if (!vertMap.has(key)) {
            vertMap.set(key, idx++);
            positions.push(v.x, v.y, v.z);
        }
        return vertMap.get(key);
    }
    for (let i = 0; i < triangles.length; i += 3) {
        indices.push(getIndex(triangles[i]), getIndex(triangles[i + 1]), getIndex(triangles[i + 2]));
    }

    const newMesh = new BABYLON.Mesh("holeFillAdvancingFront", store.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    store.scene.meshes.push(newMesh);
}


// Helper function to create a mesh from a list of vertices
function createMeshFromVertices(vertices) {
    const newMesh = new BABYLON.Mesh("holeMesh", store.scene);
    const positions = [];
    const indices = [];

    vertices.forEach((vertex, index) => {
        positions.push(vertex.x, vertex.y, vertex.z);
        if (index >= 2) {
            indices.push(0, index - 1, index);
        }
    });

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(newMesh);
    return newMesh;
}


// Only add event listener if window is defined
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initializeApp);
}

// Add these functions to your main.js

let selectedMesh = null;
let isSelectionMode = false;

// Selection mode handler
document.addEventListener('toggleMeshSelection', function () {
    isSelectionMode = !isSelectionMode;
    const selectButton = document.getElementById('selectMeshButton');

    if (isSelectionMode) {
        selectButton.classList.add('active');
        // Change cursor to indicate selection mode
        scene.defaultCursor = "pointer";

        // Add click listener to canvas
        canvas.addEventListener('click', handleMeshSelection);
    } else {
        selectButton.classList.remove('active');
        scene.defaultCursor = "default";
        canvas.removeEventListener('click', handleMeshSelection);

        // Deselect current mesh if any
        if (selectedMesh) {
            selectedMesh.renderOutline = false;
            selectedMesh = null;
        }
    }
});

// Mesh selection handler
function handleMeshSelection(event) {
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);

    // Deselect previous mesh if any
    if (selectedMesh) {
        selectedMesh.renderOutline = false;
    }

    if (pickResult.hit && pickResult.pickedMesh) {
        selectedMesh = pickResult.pickedMesh;
        // Highlight selected mesh
        selectedMesh.renderOutline = true;
        selectedMesh.outlineWidth = 0.1;
        selectedMesh.outlineColor = new BABYLON.Color3(1, 0.6, 0);
    } else {
        selectedMesh = null;
    }
}

// Download mesh handler
document.addEventListener('downloadMesh', function () {
    if (!selectedMesh) {
        alert('Please select a mesh first');
        return;
    }

    try {
        // Create STL data from the selected mesh
        const stlContent = STLExport.CreateSTL([selectedMesh], true);

        // Create blob and download
        const blob = new Blob([stlContent], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedMesh.name || 'mesh'}.stl`;
        //link.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading mesh:', error);
        alert('Failed to download mesh. Please try again.');
    }
});

document.addEventListener('clearDrawing', function () {
    clearDrawing();
});


// Event listeners for buttons to trigger the detection and hole filling actions
document.addEventListener("detectHoleBoundary", function (event) {
    if (selectedMesh) {
        // Weld vertices before boundary detection
        const weldedMesh = weldMeshVertices(selectedMesh);
        detectBoundaryEdges(weldedMesh);
    } else {
        alert("Please select a mesh first.");
    }
});

document.addEventListener("fillHole", function () {
    if (selectedMesh) {
        // Weld vertices before boundary detection
        const weldedMesh = weldMeshVertices(selectedMesh);
        fillHole(weldedMesh);
    } else {
        alert("Please select a mesh first.");
    }
});

// Zoom all handler
document.addEventListener('zoomAll', function () {
    zoomAll(scene);
});

document.addEventListener('cutMesh', function () {
    if (!selectedMesh || store.points.length < 2) {
        alert('Please select a mesh and draw at least 2 points');
        return;
    }
    // BABYLON.InitializeCSG2Async();
    // const [mesh1, mesh2] = cutMesh(scene, selectedMesh, points);
    // const meshCutter = new MeshCutter();
    // const output = meshCutter.cutMeshWithPolyline(selectedMesh, points, 
    // {scaleFactor:1, meshQuality:10} );

    const meshSplit = new MeshSplit(selectedMesh, scene);
    const output = meshSplit.splitByPolyline(store.points);

    const newMesh = output[0];
    newMesh.enableEdgesRendering(1);
    store.scene.meshes.push(newMesh);
    clearDrawing();
});

document.addEventListener('offsetMesh', function (event) {
    if (!selectedMesh) {
        alert('Please select a mesh first');
        return;
    }

    const offsetDistance = parseFloat(event.detail?.offset || prompt('Enter offset distance:', '1.0'));
    if (isNaN(offsetDistance)) {
        alert('Please enter a valid number');
        return;
    }

    const result = offsetMesh(selectedMesh, offsetDistance);
    selectedMesh.dispose();
    selectedMesh = result;
});


document.addEventListener('hideMesh', function (event) {
    if (selectedMesh) selectedMesh.visibility = 0;
});

document.addEventListener('showAll', function (event) {
    store.scene.meshes?.forEach((mesh) => mesh.visibility = 1);
});



// function cutMesh(targetMesh, cuttingPoints) {
//     if (!targetMesh || cuttingPoints.length < 2) return;

//     // Create cutting plane from points
//     const direction = cuttingPoints[1].subtract(cuttingPoints[0]).normalize();
//     const normal = Vector3.Cross(direction, Vector3.Up()).normalize();
    
//     // Create a thin box as cutting tool
//     const width = targetMesh.getBoundingInfo().boundingBox.extendSize.x * 2;
//     const height = targetMesh.getBoundingInfo().boundingBox.extendSize.y * 2;
//     const cuttingBox = MeshBuilder.CreateBox("cutter", {
//         width: width,
//         height: height,
//         depth: 0.1
//     }, scene);

//     // Position cutting box
//     cuttingBox.position = cuttingPoints[0];
//     cuttingBox.lookAt(cuttingPoints[1]);

//     // Perform CSG operations
//     const targetCSG = CSG.FromMesh(targetMesh);
//     const cutterCSG = CSG.FromMesh(cuttingBox);
    
//     // Create two parts from the cut
//     const part1 = targetCSG.subtract(cutterCSG);
//     const part2 = targetCSG.intersect(cutterCSG);

//     // Convert back to meshes
//     const resultMesh1 = part1.toMesh("part1", targetMesh.material, scene);
//     const resultMesh2 = part2.toMesh("part2", targetMesh.material, scene);

//     // Clean up
//     targetMesh.dispose();
//     cuttingBox.dispose();

//     return [resultMesh1, resultMesh2];
// }

function offsetMesh(targetMesh, offsetDistance) {
    if (!targetMesh) return;

    // Get vertex data
    const positions = targetMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const normals = targetMesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    const indices = targetMesh.getIndices();

    // Create new positions array
    const newPositions = new Float32Array(positions.length);

    // Offset each vertex along its normal
    for (let i = 0; i < positions.length; i += 3) {
        const normal = new Vector3(normals[i], normals[i + 1], normals[i + 2]);
        const offsetVector = normal.scale(offsetDistance);

        newPositions[i] = positions[i] + offsetVector.x;
        newPositions[i + 1] = positions[i + 1] + offsetVector.y;
        newPositions[i + 2] = positions[i + 2] + offsetVector.z;
    }

    // Create new mesh
    const offsetMesh = new BABYLON.Mesh("offsetMesh", scene);
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = newPositions;
    vertexData.indices = indices;
    vertexData.normals = normals;

    vertexData.applyToMesh(offsetMesh);
    offsetMesh.material = targetMesh.material;

    return offsetMesh;
}


// Export necessary functions if needed
export { initializeApp, clearDrawing };