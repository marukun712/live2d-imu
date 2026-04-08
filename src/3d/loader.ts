import { type Layer, readPsd } from "ag-psd";
import * as THREE from "three";

export interface MeshNode {
	name: string;
	path: string[];
	mesh: THREE.Mesh;
}

export type GroupMatcher = (node: MeshNode) => boolean;
export type GroupMap<T extends string> = Record<T, GroupMatcher>;

interface LayerInfo {
	name: string;
	path: string[];
	canvas: HTMLCanvasElement;
	x: number;
	y: number;
	clipping: boolean;
}

export async function getPSDMeta(url: string, skip: Set<string> = new Set()) {
	const res = await fetch(url);
	const psd = readPsd(await res.arrayBuffer());
	const layers: LayerInfo[] = [];

	function walk(layer: Layer, path: string[]) {
		if (!layer.name || layer.hidden || skip.has(layer.name)) return;
		const nextPath = [...path, layer.name.trim()];
		if (layer.children) {
			layer.children.forEach((l) => {
				walk(l, nextPath);
			});
		} else if (layer.canvas) {
			layers.push({
				name: layer.name.trim(),
				path: nextPath,
				canvas: layer.canvas,
				x: layer.left ?? 0,
				y: layer.top ?? 0,
				clipping: layer.clipping ?? false,
			});
		}
	}
	psd.children?.forEach((l) => {
		walk(l, []);
	});
	return { width: psd.width, height: psd.height, layers };
}

function compositeClipping(layers: LayerInfo[]): LayerInfo[] {
	const result: LayerInfo[] = [];
	for (const layer of layers) {
		if (layer.clipping && result.length > 0) {
			const base = result[result.length - 1];

			const tmp = document.createElement("canvas");
			tmp.width = base.canvas.width;
			tmp.height = base.canvas.height;
			const tctx = tmp.getContext("2d") as CanvasRenderingContext2D;

			tctx.drawImage(layer.canvas, layer.x - base.x, layer.y - base.y);
			tctx.globalCompositeOperation = "destination-in";
			tctx.drawImage(base.canvas, 0, 0);

			const merged = document.createElement("canvas");
			merged.width = base.canvas.width;
			merged.height = base.canvas.height;
			const mctx = merged.getContext("2d") as CanvasRenderingContext2D;
			mctx.drawImage(base.canvas, 0, 0);
			mctx.drawImage(tmp, 0, 0);

			result[result.length - 1] = { ...base, canvas: merged };
		} else {
			result.push(layer);
		}
	}
	return result;
}

export function drawCharacter3D(
	layers: LayerInfo[],
	psdW: number,
	psdH: number,
	sceneScale: number,
): MeshNode[] {
	const composited = compositeClipping(layers);

	return composited.map((layer, i) => {
		const { canvas, x, y, name, path } = layer;
		const w = canvas.width * sceneScale;
		const h = canvas.height * sceneScale;

		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshBasicMaterial({
				map: new THREE.CanvasTexture(canvas),
				transparent: true,
				depthTest: false,
				depthWrite: false,
			}),
		);
		mesh.renderOrder = i;

		mesh.position.set(
			(x + canvas.width / 2 - psdW / 2) * sceneScale,
			-(y + canvas.height / 2 - psdH / 2) * sceneScale,
			0,
		);
		return { name, path, mesh };
	});
}

export function groupMeshes<T extends string>(
	nodes: MeshNode[],
	map: GroupMap<T>,
): Partial<Record<T, THREE.Mesh[]>> {
	const result = {} as Partial<Record<T, THREE.Mesh[]>>;
	for (const [key, match] of Object.entries(map) as [T, GroupMatcher][]) {
		const matched = nodes.filter(match).map((n) => n.mesh);
		if (matched.length > 0) result[key] = matched;
	}
	return result;
}

export function byName(name: string): GroupMatcher {
	return (n) => n.name === name;
}

export function byPath(path: string[]): GroupMatcher {
	return (n) =>
		path.every((seg, i) => n.path[n.path.length - path.length + i] === seg);
}

export function psdGroup(groupName: string, negative?: string[]): GroupMatcher {
	return (n) =>
		n.path.includes(groupName) &&
		!negative?.some((neg) => n.path.includes(neg));
}

export function pipe(...matchers: GroupMatcher[]): GroupMatcher {
	return (n) => matchers.some((m) => m(n));
}
