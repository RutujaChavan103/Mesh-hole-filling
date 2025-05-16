import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export enum Dimension {
    X = 0,
    Y = 1,
    Z = 2
}

export class AABB {
    private min: Vector3;
    private max: Vector3;

    constructor(min?: Vector3, max?: Vector3) {
        this.min = min || new Vector3(Infinity, Infinity, Infinity);
        this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
    }

    isValid(): boolean {
        return this.min.x <= this.max.x && 
               this.min.y <= this.max.y && 
               this.min.z <= this.max.z;
    }

    invalidate(): void {
        this.min = new Vector3(Infinity, Infinity, Infinity);
        this.max = new Vector3(-Infinity, -Infinity, -Infinity);
    }

    getMinCorner(): Vector3 {
        return this.min;
    }

    getMaxCorner(): Vector3 {
        return this.max;
    }

    setMinCorner(pt: Vector3): void {
        this.min = pt;
    }

    setMaxCorner(pt: Vector3): void {
        this.max = pt;
    }

    length(dim: Dimension): number {
        switch(dim) {
            case Dimension.X: return this.max.x - this.min.x;
            case Dimension.Y: return this.max.y - this.min.y;
            case Dimension.Z: return this.max.z - this.min.z;
        }
    }

    getCenter(): Vector3 {
        return this.max.add(this.min).scale(0.5);
    }

    include(point: Vector3 | AABB): void {
        if (point instanceof Vector3) {
            this.min = Vector3.Minimize(this.min, point);
            this.max = Vector3.Maximize(this.max, point);
        } else {
            this.min = Vector3.Minimize(this.min, point.getMinCorner());
            this.max = Vector3.Maximize(this.max, point.getMaxCorner());
        }
    }

    contains(item: Vector3 | AABB): boolean {
        if (item instanceof Vector3) {
            return item.x >= this.min.x && item.x <= this.max.x &&
                   item.y >= this.min.y && item.y <= this.max.y &&
                   item.z >= this.min.z && item.z <= this.max.z;
        } else {
            return this.contains(item.getMinCorner()) && 
                   this.contains(item.getMaxCorner());
        }
    }

    intersects(other: AABB): boolean {
        return !(other.min.x > this.max.x || other.max.x < this.min.x ||
                other.min.y > this.max.y || other.max.y < this.min.y ||
                other.min.z > this.max.z || other.max.z < this.min.z);
    }

    getIntersection(other: AABB): AABB | null {
        const intersectionMin = new Vector3(
            Math.max(this.min.x, other.min.x),
            Math.max(this.min.y, other.min.y),
            Math.max(this.min.z, other.min.z)
        );

        const intersectionMax = new Vector3(
            Math.min(this.max.x, other.max.x),
            Math.min(this.max.y, other.max.y),
            Math.min(this.max.z, other.max.z)
        );

        const intersection = new AABB(intersectionMin, intersectionMax);
        return intersection.isValid() ? intersection : null;
    }

    maxDim(): Dimension {
        const dx = this.length(Dimension.X);
        const dy = this.length(Dimension.Y);
        const dz = this.length(Dimension.Z);
        
        if (dx >= dy && dx >= dz) return Dimension.X;
        if (dy >= dx && dy >= dz) return Dimension.Y;
        return Dimension.Z;
    }

    outerDistanceSquared(point: Vector3): number {
        let dist = 0;
        
        for (const [p, min, max] of [
            [point.x, this.min.x, this.max.x],
            [point.y, this.min.y, this.max.y],
            [point.z, this.min.z, this.max.z]
        ]) {
            if (p < min) dist += (min - p) * (min - p);
            if (p > max) dist += (p - max) * (p - max);
        }
        
        return dist;
    }
} 