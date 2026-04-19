import { type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import type { GroupMatcher } from "../rig/matcher";

/** PSD レイヤー1枚分のフラットな情報 */
export interface PSDIndex {
	/** レイヤー名*/
	name: string;
	/** ルートからこのレイヤーまでのパス */
	path: string[];
	/** ag-psd が生成した Canvas */
	canvas: HTMLCanvasElement;
	/** レイヤーの左端 X 座標 */
	x: number;
	/** レイヤーの上端 Y 座標 */
	y: number;
	/** クリッピングマスク対象か */
	clipping: boolean;
	/** 隠れレイヤかどうか*/
	hidden: boolean;
}

/** PIXI スプライトと対応するメタ情報 */
export interface SpriteNode {
	/** レイヤー名 */
	name: string;
	/** ルートからこのノードまでのパス */
	path: string[];
	/** スプライトを包む Container*/
	container: PIXI.Container;
	/** メッシュ変形可能なスプライト本体 */
	sprite: PIXI.MeshPlane;
}

/**
 * PSD ファイルを取得してレイヤーを再帰的に走査し、フラットな配列で返す。
 * グループレイヤーは展開され、末端レイヤーのみが含まれる。
 *
 * @param url - PSD ファイルの URL
 * @param skip - スキップするレイヤー名のセット
 * @returns フラット化された {@link PSDIndex} の配列
 */
export async function walkPSD(
	url: string,
	visible?: {
		show?: GroupMatcher;
		hide?: GroupMatcher;
	},
): Promise<PSDIndex[]> {
	const res = await fetch(url);
	const psd = readPsd(await res.arrayBuffer());
	const result: PSDIndex[] = [];

	function walk(layer: Layer, path: string[]) {
		if (!layer.name) return;
		const nextPath = [...path, layer.name.trim()];
		const node = { name: layer.name.trim(), path: nextPath };

		function resolveVisible(hidden: boolean): boolean {
			if (visible?.show?.(node)) return false;
			if (visible?.hide?.(node)) return true;
			return hidden;
		}

		if (layer.children) {
			for (const child of layer.children) walk(child, nextPath);
		} else if (layer.canvas) {
			result.push({
				name: layer.name.trim(),
				path: nextPath,
				canvas: layer.canvas,
				x: layer.left ?? 0,
				y: layer.top ?? 0,
				clipping: layer.clipping ?? false,
				hidden: resolveVisible(layer.hidden ?? false),
			});
		}
	}

	psd.children?.forEach((l) => {
		walk(l, []);
	});
	return result;
}

/**
 * {@link PSDIndex} の配列から PIXI スプライトを生成する。
 *
 * @param layers - {@link walkPSD} の戻り値
 * @returns {@link SpriteNode} の配列。描画順は入力と同じ
 */
export function drawCharacter(layers: PSDIndex[]): SpriteNode[] {
	const nodes: SpriteNode[] = [];

	for (const layer of layers) {
		if (layer.clipping) continue;

		const sprite = new PIXI.MeshPlane({
			texture: PIXI.Texture.from(layer.canvas),
			verticesX: 5,
			verticesY: 5,
		});
		sprite.x = layer.x;
		sprite.y = layer.y;

		const container = new PIXI.Container();
		container.visible = !layer.hidden;
		container.addChild(sprite);
		nodes.push({ name: layer.name, path: layer.path, container, sprite });
	}

	return nodes;
}
