import { AABB } from './AABB';

export class AABBNode<T> {
    protected bbox: AABB;
    protected leftChild: AABBNode<T> | null = null;
    protected rightChild: AABBNode<T> | null = null;

    constructor(bbox: AABB) {
        this.bbox = bbox;
    }

    getAABB(): AABB {
        return this.bbox;
    }

    getLeftChild(): AABBNode<T> | null {
        return this.leftChild;
    }

    getRightChild(): AABBNode<T> | null {
        return this.rightChild;
    }

    setLeftChild(node: AABBNode<T> | null): void {
        this.leftChild = node;
    }

    setRightChild(node: AABBNode<T> | null): void {
        this.rightChild = node;
    }

    isLeaf(): boolean {
        return this.leftChild === null && this.rightChild === null;
    }
}

export class AABBLeafNode<T> extends AABBNode<T> {
    private items: T[] = [];

    constructor(bbox: AABB, items?: T[]) {
        super(bbox);
        if (items) {
            this.items = [...items];
        }
    }

    getItems(): T[] {
        return this.items;
    }

    addItem(item: T): void {
        this.items.push(item);
    }

    removeItem(item: T): boolean {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
} 