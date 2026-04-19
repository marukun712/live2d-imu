import type { SpriteNode } from "../image/psd";
import { groupNodes, type KokoroGroup, psdGroup } from "./matcher";

/** 表情の表示/非表示をレイヤー名で定義するマップ */
type ExpressionDef = Record<string, boolean>;

/**
 * PSD レイヤーグループを表情パーツとして管理するクラス。
 * {@link apply} に {@link ExpressionDef} を渡すことで
 * 複数レイヤーの表示状態を一括切り替えできる。
 */
export class KokoroFace {
	private groups: Record<string, KokoroGroup>;

	constructor(nodes: SpriteNode[], layerNames: string[]) {
		this.groups = Object.fromEntries(
			layerNames.map((name) => [name, groupNodes(nodes, psdGroup(name))]),
		);
	}

	apply(def: ExpressionDef) {
		for (const [name, visible] of Object.entries(def)) {
			this.groups[name].visible = visible;
		}
	}
}
