import { type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import type { BONE_NAME } from "./rig";

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

export type GroupMatcher = (node: SpriteNode) => boolean;
export type GroupMap = Record<BONE_NAME, GroupMatcher>;

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
	let lastSprite: PIXI.MeshPlane | null = null;

	for (const layer of layers) {
		const sprite = new PIXI.MeshPlane({
			texture: PIXI.Texture.from(layer.canvas),
			verticesX: 5,
			verticesY: 5,
		});
		sprite.x = layer.x;
		sprite.y = layer.y;

		if (layer.clipping && lastSprite) {
			const mask = new PIXI.Sprite(lastSprite.texture);
			mask.x = lastSprite.x;
			mask.y = lastSprite.y;
			const container = new PIXI.Container();
			container.addChild(mask);
			sprite.mask = mask;
			container.addChild(sprite);
			nodes.push({ name: layer.name, path: layer.path, container, sprite });
		} else {
			const container = new PIXI.Container();
			container.addChild(sprite);
			nodes.push({ name: layer.name, path: layer.path, container, sprite });
		}

		lastSprite = sprite;
	}

	return nodes;
}

export function groupNodes(nodes: SpriteNode[], map: GroupMap) {
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
