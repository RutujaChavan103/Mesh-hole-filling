import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Meshes/buffer";
import { Triangle } from "./Triangle";
import { AABBTree } from "./AABBTree";
import { QueryRegion } from "./AABBTree";
import { AABB } from "./AABB";

/**
 * Class for performing spatial queries on a triangle mesh
 */
export class TriangleMesh {
    private triangles: Triangle[] = [];
    private tree: AABBTree<Triangle>;

    constructor(mesh: Mesh) {
        this.tree = new AABBTree<Triangle>();
        this.buildFromMesh(mesh);
    }

    /**
     * Build the AABB tree from a Babylon.js mesh
     */
    private buildFromMesh(mesh: Mesh): void {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const indices = mesh.getIndices();

        if (!positions || !indices) {
            throw new Error("Mesh must have position and index data");
        }

        // Create triangles
        for (let i = 0; i < indices.length; i += 3) {
            const v1 = new Vector3(
                positions[indices[i] * 3],
                positions[indices[i] * 3 + 1],
                positions[indices[i] * 3 + 2]
            );
            const v2 = new Vector3(
                positions[indices[i + 1] * 3],
                positions[indices[i + 1] * 3 + 1],
                positions[indices[i + 1] * 3 + 2]
            );
            const v3 = new Vector3(
                positions[indices[i + 2] * 3],
                positions[indices[i + 2] * 3 + 1],
                positions[indices[i + 2] * 3 + 2]
            );

            const triangle = new Triangle(v1, v2, v3, i / 3);
            this.triangles.push(triangle);
            this.tree.insert(triangle);
        }
    }

    /**
     * Find the signed distance from a point to the mesh
     */
    signedDistanceFromPoint(point: Vector3): number {
        const closestTriangle = this.findClosestTriangle(point);
        if (!closestTriangle) {
            return Number.POSITIVE_INFINITY;
        }
        return closestTriangle.signedDistance(point);
    }

    /**
     * Find the closest triangle to a given point
     */
    findClosestTriangle(point: Vector3): Triangle | null {
        // Create a sphere query that starts small and grows until it finds triangles
        let radius = 0.1; // Start with a small radius
        const maxRadius = 1000; // Maximum search radius
        const growthFactor = 2; // How much to grow the radius each iteration

        while (radius < maxRadius) {
            const query = new TriangleSphereQuery(point, radius);
            const candidates = this.tree.query(query);

            if (candidates.length > 0) {
                // Find the closest among candidates
                let closestTriangle = candidates[0];
                let minDistSq = closestTriangle.squaredDistanceToPoint(point);

                for (let i = 1; i < candidates.length; i++) {
                    const distSq = candidates[i].squaredDistanceToPoint(point);
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        closestTriangle = candidates[i];
                    }
                }

                return closestTriangle;
            }

            radius *= growthFactor;
        }

        return null;
    }
}

/**
 * Sphere query region implementation specifically for triangles
 */
class TriangleSphereQuery implements QueryRegion<Triangle> {
    private radiusSquared: number;

    constructor(private center: Vector3, radius: number) {
        this.radiusSquared = radius * radius;
    }

    intersects(aabb: AABB): boolean {
        return aabb.outerDistanceSquared(this.center) <= this.radiusSquared;
    }

    contains(item: Triangle): boolean {
        return item.squaredDistanceToPoint(this.center) <= this.radiusSquared;
    }
}
