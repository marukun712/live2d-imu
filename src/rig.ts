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
	private readonly vertsIdx: Record<BONE_NAME, { start: number; end: number }>;
	private readonly nodeRanges: Map<SpriteNode, { start: number; end: number }>;
	private time = 0;

	private readonly uvs: number[];
	public readonly ffd: Record<BONE_NAME, number[]>;

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

		this.uvs = new Array(verts.length).fill(0);
		this.ffd = {} as Record<BONE_NAME, number[]>;

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

			for (let i = start; i < end; i += 2) {
				this.uvs[i] = maxX === minX ? 0 : (verts[i] - minX) / (maxX - minX);
				this.uvs[i + 1] =
					maxY === minY ? 0 : (verts[i + 1] - minY) / (maxY - minY);
			}

			this.ffd[bone] = [minX, minY, maxX, minY, minX, maxY, maxX, maxY];
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
			if (start === end || !this.ffd[bone]) continue;

			const f = [...this.ffd[bone]];

			if (bone.startsWith("hair")) {
				const offset = Math.sin(this.time) * 10;
				f[4] += offset;
				f[6] += offset;
			}

			for (let i = start; i < end; i += 2) {
				const u = this.uvs[i];
				const v = this.uvs[i + 1];

				const tX = f[0] + u * (f[2] - f[0]);
				const tY = f[1] + u * (f[3] - f[1]);
				const bX = f[4] + u * (f[6] - f[4]);
				const bY = f[5] + u * (f[7] - f[5]);

				this.verts[i] = tX + v * (bX - tX);
				this.verts[i + 1] = tY + v * (bY - tY);
			}
		}

		this.applyVerts();
	}
}
