import { Animation, Vector3, Scene } from "@babylonjs/core";

export function zoomAll(scene) {
    try {
        // Get all meshes in the scene
        const meshes = scene.meshes;

        if (meshes.length === 0) {
            alert('No meshes found in scene');
            return;
        }

        // Calculate bounding box containing all meshes
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        meshes.forEach(mesh => {
            const boundingBox = mesh.getBoundingInfo().boundingBox;

            minX = Math.min(minX, boundingBox.minimumWorld.x);
            minY = Math.min(minY, boundingBox.minimumWorld.y);
            minZ = Math.min(minZ, boundingBox.minimumWorld.z);

            maxX = Math.max(maxX, boundingBox.maximumWorld.x);
            maxY = Math.max(maxY, boundingBox.maximumWorld.y);
            maxZ = Math.max(maxZ, boundingBox.maximumWorld.z);
        });

        // Calculate center point and radius
        const center = new Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        const radius = Math.max(
            maxX - minX,
            maxY - minY,
            maxZ - minZ
        );

        // Position camera to view all meshes
        const camera = scene.activeCamera;
        const aspectRatio = scene.getEngine().getAspectRatio(camera);
        const fov = camera.fov;

        // Calculate distance needed to view entire scene
        const distance = (radius / 2) / Math.tan(fov / 2);

        // Animate camera to new position
    Animation.CreateAndStartAnimation(
            "cameraMove",
            camera,
            "position",
            30,
            60,
            camera.position,
            new Vector3(
                center.x,
                center.y,
                center.z + distance * 1.5
            ),
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Look at center of all meshes
        camera.setTarget(center);

    } catch (error) {
        console.error('Error during zoom all:', error);
        alert('Failed to zoom to all meshes. Please try again.');
    }
}