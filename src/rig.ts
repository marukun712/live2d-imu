import type * as PIXI from "pixi.js";
import type { SpriteNode } from "./loader";

export const BONE_LIST = [
	"head",
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
	private readonly origVerts: number[];
	private readonly vertsIdx: Record<BONE_NAME, { start: number; end: number }>;
	private readonly nodeRanges: Map<SpriteNode, { start: number; end: number }>;
	private time = 0;

	public readonly centers: Record<
		BONE_NAME,
		{ x: number; y: number; sigma: number }
	>;
	public readonly offsets: Record<BONE_NAME, { x: number; y: number }>;

	constructor(
		app: PIXI.Application,
		nodes: SpriteNode[],
		verts: number[],
		vertsIdx: Record<BONE_NAME, { start: number; end: number }>,
		nodeRanges: Map<SpriteNode, { start: number; end: number }>,
	) {
		this.nodes = nodes;
		this.verts = verts;
		this.origVerts = [...verts];
		this.vertsIdx = vertsIdx;
		this.nodeRanges = nodeRanges;

		this.centers = {} as Record<
			BONE_NAME,
			{ x: number; y: number; sigma: number }
		>;
		this.offsets = {} as Record<BONE_NAME, { x: number; y: number }>;

		for (const bone of BONE_LIST) {
			const { start, end } = this.vertsIdx[bone];
			if (start === end) continue;

			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;
			for (let i = start; i < end; i += 2) {
				if (verts[i] < minX) minX = verts[i];
				if (verts[i] > maxX) maxX = verts[i];
				if (verts[i + 1] < minY) minY = verts[i + 1];
				if (verts[i + 1] > maxY) maxY = verts[i + 1];
			}

			const cX = (minX + maxX) / 2;
			const cY = (minY + maxY) / 2;
			const sigma = Math.max(maxX - minX, maxY - minY) || 1;

			this.centers[bone] = { x: cX, y: cY, sigma };
			this.offsets[bone] = { x: 0, y: 0 };
		}

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

		for (const bone of BONE_LIST) {
			const { start, end } = this.vertsIdx[bone];
			if (start === end || !this.centers[bone]) continue;

			let dx = this.offsets[bone].x;
			const dy = this.offsets[bone].y;

			if (bone.startsWith("hair")) {
				dx += Math.sin(this.time) * 10;
			}

			const { x: cX, y: cY, sigma } = this.centers[bone];
			const sig2 = sigma * sigma;

			for (let i = start; i < end; i += 2) {
				const ox = this.origVerts[i];
				const oy = this.origVerts[i + 1];

				const d2 = (ox - cX) ** 2 + (oy - cY) ** 2;
				const w = Math.exp(-d2 / sig2);

				this.verts[i] = ox + dx * w;
				this.verts[i + 1] = oy + dy * w;
			}
		}

		this.applyVerts();
	}
}
