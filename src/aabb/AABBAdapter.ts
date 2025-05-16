import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AABB } from './AABB';

/**
 * Interface for objects that can provide their own AABB
 */
export interface AABBProvider {
    getAABB(): AABB;
}

/**
 * Default adapter for computing AABBs of objects that implement AABBProvider
 */
export class AABBAdapter<T extends AABBProvider> {
    getAABB(item: T): AABB {
        return item.getAABB();
    }
} 