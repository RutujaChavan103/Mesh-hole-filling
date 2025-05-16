import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AABB } from './AABB';
import { AABBProvider } from './AABBAdapter';

export class Triangle implements AABBProvider {
    private normal: Vector3;
    private center: Vector3;
    private aabb: AABB | null = null;

    constructor(
        public readonly v1: Vector3,
        public readonly v2: Vector3,
        public readonly v3: Vector3,
        public readonly index: number
    ) {
        // Compute triangle normal and center
        const edge1 = v2.subtract(v1);
        const edge2 = v3.subtract(v1);
        this.normal = Vector3.Cross(edge1, edge2).normalize();
        this.center = v1.add(v2).add(v3).scale(1/3);
    }

    getAABB(): AABB {
        if (!this.aabb) {
            this.aabb = new AABB();
            this.aabb.include(this.v1);
            this.aabb.include(this.v2);
            this.aabb.include(this.v3);
        }
        return this.aabb;
    }

    /**
     * Compute signed distance from a point to this triangle
     */
    signedDistance(point: Vector3): number {
        // First compute the distance to the triangle's plane
        const planeDistance = Vector3.Dot(point.subtract(this.v1), this.normal);

        // Project point onto triangle's plane
        const projectedPoint = point.subtract(this.normal.scale(planeDistance));

        // If projected point is inside triangle, return signed distance
        if (this.isPointInTriangle(projectedPoint)) {
            return planeDistance;
        }

        // Otherwise, return distance to closest point on triangle edges
        return Math.sign(planeDistance) * Math.sqrt(this.squaredDistanceToPoint(point));
    }

    /**
     * Compute squared distance from a point to this triangle
     */
    squaredDistanceToPoint(point: Vector3): number {
        // Project point onto triangle's plane
        const planeDistance = Vector3.Dot(point.subtract(this.v1), this.normal);
        const projectedPoint = point.subtract(this.normal.scale(planeDistance));

        // If point projects inside triangle, just return squared plane distance
        if (this.isPointInTriangle(projectedPoint)) {
            return planeDistance * planeDistance;
        }

        // Otherwise, find closest point on triangle edges
        const edges = [
            [this.v1, this.v2],
            [this.v2, this.v3],
            [this.v3, this.v1]
        ];

        let minDistSq = Number.POSITIVE_INFINITY;
        for (const [start, end] of edges) {
            const edgeDir = end.subtract(start);
            const edgeLength = edgeDir.length();
            const edgeNorm = edgeDir.scale(1/edgeLength);
            
            const pointToStart = point.subtract(start);
            const t = Vector3.Dot(pointToStart, edgeNorm);
            
            if (t <= 0) {
                // Closest to start vertex
                minDistSq = Math.min(minDistSq, pointToStart.lengthSquared());
            } else if (t >= edgeLength) {
                // Closest to end vertex
                const pointToEnd = point.subtract(end);
                minDistSq = Math.min(minDistSq, pointToEnd.lengthSquared());
            } else {
                // Closest to edge interior
                const closestPoint = start.add(edgeNorm.scale(t));
                const diff = point.subtract(closestPoint);
                minDistSq = Math.min(minDistSq, diff.lengthSquared());
            }
        }

        return minDistSq;
    }

    private isPointInTriangle(point: Vector3): boolean {
        // Using barycentric coordinates
        const v0 = this.v2.subtract(this.v1);
        const v1 = this.v3.subtract(this.v1);
        const v2 = point.subtract(this.v1);

        const dot00 = Vector3.Dot(v0, v0);
        const dot01 = Vector3.Dot(v0, v1);
        const dot02 = Vector3.Dot(v0, v2);
        const dot11 = Vector3.Dot(v1, v1);
        const dot12 = Vector3.Dot(v1, v2);

        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return u >= 0 && v >= 0 && u + v <= 1;
    }
} 