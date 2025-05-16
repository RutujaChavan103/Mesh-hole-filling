import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AABB } from './AABB';
import { QueryRegion } from './AABBTree';
import { AABBProvider } from './AABBAdapter';

/**
 * Implementation of a spherical query region for AABB tree queries
 */
export class SphereQueryRegion<T extends AABBProvider> implements QueryRegion<T> {
    private center: Vector3;
    private radius: number;
    private radiusSquared: number;
    private boundingBox: AABB;

    constructor(center: Vector3, radius: number) {
        this.center = center.clone(); // Clone to avoid external modifications
        this.radius = radius;
        this.radiusSquared = radius * radius;
        this.updateBoundingBox();
    }

    intersects(aabb: AABB): boolean {
        return aabb.outerDistanceSquared(this.center) <= this.radiusSquared;
    }

    contains(item: T): boolean {
        const itemAABB = item.getAABB();
        const itemCenter = itemAABB.getCenter();
        return this.containsPoint(itemCenter);
    }

    containsPoint(point: Vector3): boolean {
        return Vector3.DistanceSquared(point, this.center) <= this.radiusSquared;
    }

    getCenter(): Vector3 {
        return this.center.clone(); // Return clone to prevent external modifications
    }

    getRadius(): number {
        return this.radius;
    }

    setCenter(newCenter: Vector3): void {
        this.center = newCenter.clone(); // Clone to avoid external modifications
        this.updateBoundingBox();
    }

    setRadius(newRadius: number): void {
        if (newRadius < 0) {
            throw new Error("Radius must be non-negative");
        }
        this.radius = newRadius;
        this.radiusSquared = newRadius * newRadius;
        this.updateBoundingBox();
    }

    private updateBoundingBox(): void {
        const min = new Vector3(
            this.center.x - this.radius,
            this.center.y - this.radius,
            this.center.z - this.radius
        );
        const max = new Vector3(
            this.center.x + this.radius,
            this.center.y + this.radius,
            this.center.z + this.radius
        );
        this.boundingBox = new AABB(min, max);
    }
} 