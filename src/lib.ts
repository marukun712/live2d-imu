import type { Layer, Psd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

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
	container: Container2d;
}

export type GroupMatcher = (node: SpriteNode) => boolean;
export type GroupMap<T extends string> = Record<T, GroupMatcher>;

export function getPSDIndex(psd: Psd, skip: Set<string> = new Set()) {
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
	let lastSprite: Sprite2d | null = null;

	for (const layer of layers) {
		const sprite = new Sprite2d(PIXI.Texture.from(layer.canvas));
		sprite.x = layer.x;
		sprite.y = layer.y;

		if (layer.clipping && lastSprite) {
			const mask = new Sprite2d(lastSprite.texture);
			mask.x = lastSprite.x;
			mask.y = lastSprite.y;
			const container = new Container2d();
			container.addChild(mask);
			sprite.mask = mask;
			container.addChild(sprite);
			nodes.push({ name: layer.name, path: layer.path, container });
		} else {
			const container = new Container2d();
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
): Partial<Record<T, Container2d>> {
	const result: Partial<Record<T, Container2d>> = {};
	for (const [key, match] of Object.entries(map) as [T, GroupMatcher][]) {
		const matched = nodes.filter(match);
		if (matched.length === 0) continue;
		if (matched.length === 1) {
			result[key] = matched[0].container;
		} else {
			const group = new Container2d();
			matched.forEach((n) => {
				group.addChild(n.container);
			});
			result[key] = group;
		}
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
