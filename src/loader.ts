import { type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";

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
}

export type GroupMatcher = (node: SpriteNode) => boolean;
export type GroupMap<T extends string> = Record<T, GroupMatcher>;

export async function getPSDIndex(url: string, skip: Set<string> = new Set()) {
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
	let lastSprite: PIXI.Sprite | null = null;

	for (const layer of layers) {
		const sprite = new PIXI.Sprite(PIXI.Texture.from(layer.canvas));
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
			nodes.push({ name: layer.name, path: layer.path, container });
		} else {
			const container = new PIXI.Container();
			container.addChild(sprite);
			nodes.push({ name: layer.name, path: layer.path, container });
		}

		lastSprite = sprite;
	}

	return nodes;
}

export function groupNodes<T extends string>(
	nodes: SpriteNode[],
	map: GroupMap<T>,
): Record<T, PIXI.Container[]> {
	const result = {} as Record<T, PIXI.Container[]>;
	for (const [key, match] of Object.entries(map) as [T, GroupMatcher][]) {
		const matched = nodes.filter(match).map((n) => n.container);
		if (matched.length > 0) result[key as T] = matched;
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
