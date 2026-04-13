import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import type { BONE_NAME, FACE_NAME } from "./rig";

export interface PSDIndex {
	name: string;
	path: string[];
	canvas: HTMLCanvasElement;
	x: number;
	y: number;
	clipping: boolean;
}

export interface SpriteNode {
	name: string;
	path: string[];
	container: PIXI.Container;
	sprite: PIXI.MeshPlane;
}

export interface KokoroGroup {
	nodes: SpriteNode[];
	x: number;
	y: number;
	alpha: number;
	visible: boolean;
	scaleX: number;
	scaleY: number;
}

export type GroupMatcher = (node: SpriteNode) => boolean;
export type RigMap = Record<BONE_NAME, GroupMatcher>;
export type GroupMap = Record<FACE_NAME, GroupMatcher>;

export async function setupCanvas(parent: HTMLElement) {
	const app = (async () => {
		initializeCanvas((width, height) => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			return canvas;
		});

		const app = new PIXI.Application();
		await app.init({
			resizeTo: window,
			backgroundColor: 0xffffff,
		});
		parent.appendChild(app.canvas);
		return app;
	})();

	return await app;
}

export async function walkPSD(url: string, skip: Set<string> = new Set()) {
	const res = await fetch(url);
	const psd = readPsd(await res.arrayBuffer());

	const result: PSDIndex[] = [];

	function walk(layer: Layer, path: string[]) {
		if (!layer.name || layer.hidden || skip.has(layer.name)) return;
		const nextPath = [...path, layer.name.trim()];
		if (layer.children) {
			layer.children.forEach((l) => {
				walk(l, nextPath);
			});
		} else if (layer.canvas) {
			result.push({
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

	return result;
}

export function drawCharacter(layers: PSDIndex[]) {
	const nodes: SpriteNode[] = [];

	for (const layer of layers) {
		const sprite = new PIXI.MeshPlane({
			texture: PIXI.Texture.from(layer.canvas),
			verticesX: 5,
			verticesY: 5,
		});
		sprite.x = layer.x;
		sprite.y = layer.y;

		if (!layer.clipping) {
			const container = new PIXI.Container();
			container.addChild(sprite);
			nodes.push({ name: layer.name, path: layer.path, container, sprite });
		}
	}

	return nodes;
}

export function rigNodes(nodes: SpriteNode[], map: RigMap) {
	const idx = {} as Record<BONE_NAME, { start: number; end: number }>;
	const verts: number[] = [];
	const nodeRanges = new Map<SpriteNode, { start: number; end: number }>();

	for (const [key, match] of Object.entries(map) as [
		BONE_NAME,
		GroupMatcher,
	][]) {
		const matched = nodes.filter(match);
		const start = verts.length;

		for (const n of matched) {
			const s = verts.length;
			verts.push(...n.sprite.geometry.getBuffer("aPosition").data);
			nodeRanges.set(n, { start: s, end: verts.length });
		}

		idx[key] = { start, end: verts.length };
	}

	return { verts, idx, nodeRanges };
}

export function groupNodes(
	nodes: SpriteNode[],
	map: GroupMap,
): Record<FACE_NAME, KokoroGroup> {
	const result = {} as Record<FACE_NAME, KokoroGroup>;
	for (const [key, match] of Object.entries(map) as [
		FACE_NAME,
		GroupMatcher,
	][]) {
		const matched = nodes.filter(match);
		const containers = matched.map((n) => n.container);

		const group: KokoroGroup = {
			nodes: matched,
			get x() {
				return containers[0]?.x ?? 0;
			},
			set x(v: number) {
				containers.forEach((c) => {
					c.x = v;
				});
			},
			get y() {
				return containers[0]?.y ?? 0;
			},
			set y(v: number) {
				containers.forEach((c) => {
					c.y = v;
				});
			},
			get alpha() {
				return containers[0]?.alpha ?? 1;
			},
			set alpha(v: number) {
				containers.forEach((c) => {
					c.alpha = v;
				});
			},
			get visible() {
				return containers[0]?.visible ?? true;
			},
			set visible(v: boolean) {
				containers.forEach((c) => {
					c.visible = v;
				});
			},
			get scaleX() {
				return containers[0]?.scale.x ?? 1;
			},
			set scaleX(v: number) {
				containers.forEach((c) => {
					c.scale.x = v;
				});
			},
			get scaleY() {
				return containers[0]?.scale.y ?? 1;
			},
			set scaleY(v: number) {
				containers.forEach((c) => {
					c.scale.y = v;
				});
			},
		};

		result[key] = group;
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
