import type * as THREE from "three";

export class KokoroRig<
	T extends Record<string, { depth: number; move?: number }>,
> {
	private readonly camera: THREE.PerspectiveCamera;
	private range: number;

	private readonly current = { x: 0, y: 0 };
	private focus = { x: 0, y: 0 };

	private readonly meshGroups: Partial<Record<keyof T, THREE.Mesh[]>>;
	private readonly rigMap: T;

	constructor(
		rigMap: T,
		meshGroups: Partial<Record<keyof T, THREE.Mesh[]>>,
		camera: THREE.PerspectiveCamera,
		range: number,
	) {
		this.camera = camera;
		this.range = range;
		this.meshGroups = meshGroups;
		this.rigMap = rigMap;
		for (const [key, meshes] of Object.entries(meshGroups) as [
			keyof T,
			THREE.Mesh[],
		][]) {
			const depth = rigMap[key]?.depth ?? 0;
			for (const mesh of meshes ?? []) {
				mesh.position.z = depth * 15;
				mesh.userData.baseX = mesh.position.x;
				mesh.userData.baseY = mesh.position.y;
			}
		}
	}

	setFocus(x: number, y: number) {
		this.focus = { x, y };
	}

	tick() {
		this.current.x += (this.focus.x - this.current.x) * 0.1;
		this.current.y += (this.focus.y - this.current.y) * 0.1;

		this.camera.position.x = -this.current.x * this.range * 0.8;
		this.camera.lookAt(0, 0, 0);

		for (const [key, meshes] of Object.entries(this.meshGroups) as [
			keyof T,
			THREE.Mesh[],
		][]) {
			const entry = this.rigMap[key];
			const depth = entry?.depth ?? 0;
			const move = entry && "move" in entry ? (entry.move as number) : 1;
			for (const mesh of meshes ?? []) {
				mesh.position.x =
					mesh.userData.baseX +
					this.current.x * depth * this.range * 0.01 * move;
				mesh.position.y =
					mesh.userData.baseY +
					this.current.y * depth * -this.range * 0.01 * move;
			}
		}
	}
}
