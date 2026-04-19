import type { SpriteNode } from "../image/psd";
import { groupNodes, type KokoroGroup, psdGroup } from "./matcher";

type ExpressionDef = Record<string, boolean>;

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
