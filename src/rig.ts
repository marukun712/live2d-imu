import type * as PIXI from "pixi.js";
import type { SpriteNode } from "./loader";

export const BONE_LIST = [
	"head",
	"eyeL",
	"eyeR",
	"body",
	"forearmL",
	"upperArmL",
	"forearmR",
	"upperArmR",
	"legs",
	"hairFront",
	"hairSide",
	"hairBack",
] as const;

export type BONE_NAME = (typeof BONE_LIST)[number];

export class KokoroRig {
	private readonly nodes: SpriteNode[];
	private readonly verts: number[];
	private readonly vertsIdx: Record<BONE_NAME, { start: number; end: number }>;
	private readonly nodeRanges: Map<SpriteNode, { start: number; end: number }>;
	private time = 0;

	constructor(
		app: PIXI.Application,
		nodes: SpriteNode[],
		verts: number[],
		vertsIdx: Record<BONE_NAME, { start: number; end: number }>,
		nodeRanges: Map<SpriteNode, { start: number; end: number }>,
	) {
		this.nodes = nodes;
		this.verts = verts;
		this.vertsIdx = vertsIdx;
		this.nodeRanges = nodeRanges;

		app.ticker.add(() => this.tick());
	}

	private applyVerts() {
		for (const node of this.nodes) {
			const range = this.nodeRanges.get(node);
			if (!range) continue;
			const buffer = node.sprite.geometry.getBuffer("aPosition");
			const data = buffer.data as Float32Array;
			for (let i = 0; i < range.end - range.start; i++) {
				data[i] = this.verts[range.start + i];
			}
			buffer.update();
		}
	}

	private tick() {
		this.time += 0.05;

		const targets = [
			this.vertsIdx.hairFront,
			this.vertsIdx.hairSide,
			this.vertsIdx.hairBack,
		];

		for (const { start, end } of targets) {
			const len = end - start;
			for (let i = 0; i < len; i += 2) {
				const w = i / len;
				this.verts[start + i] += Math.sin(this.time - w * 5) * w * 0.5;
			}
		}

		this.applyVerts();
	}
}
