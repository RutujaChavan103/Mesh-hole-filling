import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AABB, Dimension } from './AABB';
import { AABBNode, AABBLeafNode } from './AABBNode';
import { AABBAdapter, AABBProvider } from './AABBAdapter';

/**
 * Interface for spatial query regions
 */
export interface QueryRegion<T> {
    /**
     * Check if the region intersects with the given AABB
     */
    intersects(aabb: AABB): boolean;
    
    /**
     * Check if the region contains the given item
     */
    contains(item: T): boolean;
}

/**
 * AABB Tree implementation for efficient spatial queries
 */
export class AABBTree<T extends AABBProvider> {
    private root: AABBNode<T> | null = null;
    private adapter: AABBAdapter<T>;
    private maxDepth: number;
    private maxLeafSize: number;
    private numItems: number = 0;

    constructor(maxDepth: number = 20, maxLeafSize: number = 20) {
        this.adapter = new AABBAdapter<T>();
        this.maxDepth = maxDepth;
        this.maxLeafSize = maxLeafSize;
    }

    insert(item: T): void {
        const itemAABB = this.adapter.getAABB(item);
        if (!itemAABB.isValid()) {
            return;
        }

        if (!this.root) {
            this.root = new AABBLeafNode<T>(itemAABB, [item]);
            this.numItems = 1;
            return;
        }

        const leafNode = this.findBestLeaf(this.root, itemAABB);
        if (leafNode instanceof AABBLeafNode) {
            leafNode.addItem(item);
            this.numItems++;
            this.rebalanceIfNeeded(leafNode);
        }
    }

    remove(item: T): boolean {
        if (!this.root) return false;

        const itemAABB = this.adapter.getAABB(item);
        const node = this.findNodeContaining(this.root, item, itemAABB);
        
        if (node instanceof AABBLeafNode) {
            const removed = node.removeItem(item);
            if (removed) {
                this.numItems--;
                this.updateAABBs(node);
            }
            return removed;
        }
        
        return false;
    }

    clear(): void {
        this.root = null;
        this.numItems = 0;
    }

    isEmpty(): boolean {
        return this.numItems === 0;
    }

    size(): number {
        return this.numItems;
    }

    query(region: QueryRegion<T>): T[] {
        const results: T[] = [];
        if (!this.root) return results;
        this.queryNode(this.root, region, results);
        return results;
    }

    private queryNode(node: AABBNode<T>, region: QueryRegion<T>, results: T[]): void {
        if (!region.intersects(node.getAABB())) {
            return;
        }

        if (node instanceof AABBLeafNode) {
            for (const item of node.getItems()) {
                if (region.contains(item)) {
                    results.push(item);
                }
            }
            return;
        }

        const leftChild = node.getLeftChild();
        const rightChild = node.getRightChild();

        if (leftChild) this.queryNode(leftChild, region, results);
        if (rightChild) this.queryNode(rightChild, region, results);
    }

    private findBestLeaf(node: AABBNode<T>, itemAABB: AABB): AABBNode<T> {
        if (node.isLeaf()) {
            return node;
        }

        const leftChild = node.getLeftChild();
        const rightChild = node.getRightChild();

        if (!leftChild || !rightChild) return node;

        const leftEnlargement = this.computeEnlargement(leftChild.getAABB(), itemAABB);
        const rightEnlargement = this.computeEnlargement(rightChild.getAABB(), itemAABB);

        return leftEnlargement <= rightEnlargement 
            ? this.findBestLeaf(leftChild, itemAABB)
            : this.findBestLeaf(rightChild, itemAABB);
    }

    private findNodeContaining(node: AABBNode<T>, item: T, itemAABB: AABB): AABBNode<T> | null {
        if (!node.getAABB().contains(itemAABB)) {
            return null;
        }

        if (node instanceof AABBLeafNode) {
            return node.getItems().includes(item) ? node : null;
        }

        const leftChild = node.getLeftChild();
        const rightChild = node.getRightChild();

        if (leftChild) {
            const found = this.findNodeContaining(leftChild, item, itemAABB);
            if (found) return found;
        }

        if (rightChild) {
            return this.findNodeContaining(rightChild, item, itemAABB);
        }

        return null;
    }

    private computeEnlargement(aabb: AABB, itemAABB: AABB): number {
        const enlarged = new AABB(aabb.getMinCorner(), aabb.getMaxCorner());
        enlarged.include(itemAABB);
        
        const originalVolume = this.computeVolume(aabb);
        const enlargedVolume = this.computeVolume(enlarged);
        
        return enlargedVolume - originalVolume;
    }

    private computeVolume(aabb: AABB): number {
        return aabb.length(Dimension.X) * 
               aabb.length(Dimension.Y) * 
               aabb.length(Dimension.Z);
    }

    private rebalanceIfNeeded(leafNode: AABBLeafNode<T>): void {
        if (leafNode.getItems().length <= this.maxLeafSize) {
            return;
        }

        const items = leafNode.getItems();
        const bbox = leafNode.getAABB();
        const splitDim = bbox.maxDim();
        
        // Sort items by their center along the split dimension
        items.sort((a, b) => {
            const aCenter = this.adapter.getAABB(a).getCenter();
            const bCenter = this.adapter.getAABB(b).getCenter();
            return this.getCoord(aCenter, splitDim) - this.getCoord(bCenter, splitDim);
        });

        const median = Math.floor(items.length / 2);
        const leftItems = items.slice(0, median);
        const rightItems = items.slice(median);

        const leftAABB = this.computeAABBForItems(leftItems);
        const rightAABB = this.computeAABBForItems(rightItems);

        const leftNode = new AABBLeafNode<T>(leftAABB, leftItems);
        const rightNode = new AABBLeafNode<T>(rightAABB, rightItems);

        if (leafNode === this.root) {
            this.root = new AABBNode<T>(bbox);
            this.root.setLeftChild(leftNode);
            this.root.setRightChild(rightNode);
        } else {
            // Replace the leaf with an internal node
            const parent = this.findParent(this.root!, leafNode);
            if (parent) {
                const newNode = new AABBNode<T>(bbox);
                newNode.setLeftChild(leftNode);
                newNode.setRightChild(rightNode);
                
                if (parent.getLeftChild() === leafNode) {
                    parent.setLeftChild(newNode);
                } else {
                    parent.setRightChild(newNode);
                }
            }
        }
    }

    private findParent(node: AABBNode<T>, target: AABBNode<T>): AABBNode<T> | null {
        if (node.getLeftChild() === target || node.getRightChild() === target) {
            return node;
        }

        const leftChild = node.getLeftChild();
        const rightChild = node.getRightChild();

        if (leftChild) {
            const found = this.findParent(leftChild, target);
            if (found) return found;
        }

        if (rightChild) {
            return this.findParent(rightChild, target);
        }

        return null;
    }

    private computeAABBForItems(items: T[]): AABB {
        const aabb = new AABB();
        for (const item of items) {
            aabb.include(this.adapter.getAABB(item));
        }
        return aabb;
    }

    private getCoord(point: Vector3, dim: Dimension): number {
        switch (dim) {
            case Dimension.X: return point.x;
            case Dimension.Y: return point.y;
            case Dimension.Z: return point.z;
            default: return point.x; // Default to X to satisfy TypeScript
        }
    }

    private updateAABBs(node: AABBNode<T>): void {
        const parent = this.findParent(this.root!, node);
        if (!parent) return;

        let current: AABBNode<T> | null = parent;
        while (current) {
            const leftChild = current.getLeftChild();
            const rightChild = current.getRightChild();
            
            const newAABB = new AABB();
            if (leftChild) newAABB.include(leftChild.getAABB());
            if (rightChild) newAABB.include(rightChild.getAABB());
            
            current = this.findParent(this.root!, current);
        }
    }
} 