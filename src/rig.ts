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

export type Point = [number, number];
export type GridOffsets = Point | Point[];
export type Template = Record<string, Partial<Record<BONE_NAME, GridOffsets>>>;

export const POSE_TEMPLATES: Template = {
	normal: {},
	left: {
		head: [-40, 0],
		hairFront: [-60, 0],
		hairSide: [-50, 0],
		hairBack: [30, 0],
		body: [-20, 0],
		legs: [-10, 0],
	},
	right: {
		head: [40, 0],
		hairFront: [60, 0],
		hairSide: [50, 0],
		hairBack: [-30, 0],
		body: [20, 0],
		legs: [10, 0],
	},
	tiltLeft: {
		head: [
			[-550, 300],
			[-550, 300],
			[-550, 300],
			[-450, 220],
			[-450, 220],
			[-450, 220],
			[-350, 150],
			[-350, 150],
			[-350, 150],
		],
		hairFront: [
			[-570, 310],
			[-570, 310],
			[-570, 310],
			[-460, 230],
			[-460, 230],
			[-460, 230],
			[-350, 150],
			[-350, 150],
			[-350, 150],
		],
		hairSide: [
			[-560, 305],
			[-560, 305],
			[-560, 305],
			[-455, 225],
			[-455, 225],
			[-455, 225],
			[-350, 150],
			[-350, 150],
			[-350, 150],
		],
		hairBack: [
			[-520, 280],
			[-520, 280],
			[-520, 280],
			[-430, 200],
			[-430, 200],
			[-430, 200],
			[-350, 150],
			[-350, 150],
			[-350, 150],
		],

		body: [
			[-350, 150],
			[-350, 150],
			[-350, 150],
			[-220, 80],
			[-220, 80],
			[-220, 80],
			[-120, 30],
			[-120, 30],
			[-120, 30],
		],

		legs: [
			[-120, 30],
			[-120, 30],
			[-120, 30],
			[-50, 10],
			[-50, 10],
			[-50, 10],
			[0, 0],
			[0, 0],
			[0, 0],
		],

		upperArmL: [
			[-350, 150],
			[-350, 150],
			[-350, 150],
			[-290, 120],
			[-290, 120],
			[-290, 120],
			[-240, 90],
			[-240, 90],
			[-240, 90],
		],
		upperArmR: [
			[-350, 150],
			[-350, 150],
			[-350, 150],
			[-290, 120],
			[-290, 120],
			[-290, 120],
			[-240, 90],
			[-240, 90],
			[-240, 90],
		],
		forearmL: [
			[-240, 90],
			[-240, 90],
			[-240, 90],
			[-180, 60],
			[-180, 60],
			[-180, 60],
			[-130, 40],
			[-130, 40],
			[-130, 40],
		],
		forearmR: [
			[-240, 90],
			[-240, 90],
			[-240, 90],
			[-180, 60],
			[-180, 60],
			[-180, 60],
			[-130, 40],
			[-130, 40],
			[-130, 40],
		],
	},

	tiltRight: {
		head: [
			[550, 300],
			[550, 300],
			[550, 300],
			[450, 220],
			[450, 220],
			[450, 220],
			[350, 150],
			[350, 150],
			[350, 150],
		],
		hairFront: [
			[570, 310],
			[570, 310],
			[570, 310],
			[460, 230],
			[460, 230],
			[460, 230],
			[350, 150],
			[350, 150],
			[350, 150],
		],
		hairSide: [
			[560, 305],
			[560, 305],
			[560, 305],
			[455, 225],
			[455, 225],
			[455, 225],
			[350, 150],
			[350, 150],
			[350, 150],
		],
		hairBack: [
			[520, 280],
			[520, 280],
			[520, 280],
			[430, 200],
			[430, 200],
			[430, 200],
			[350, 150],
			[350, 150],
			[350, 150],
		],
		body: [
			[350, 150],
			[350, 150],
			[350, 150],
			[220, 80],
			[220, 80],
			[220, 80],
			[120, 30],
			[120, 30],
			[120, 30],
		],
		legs: [
			[120, 30],
			[120, 30],
			[120, 30],
			[50, 10],
			[50, 10],
			[50, 10],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		upperArmL: [
			[350, 150],
			[350, 150],
			[350, 150],
			[290, 120],
			[290, 120],
			[290, 120],
			[240, 90],
			[240, 90],
			[240, 90],
		],
		upperArmR: [
			[350, 150],
			[350, 150],
			[350, 150],
			[290, 120],
			[290, 120],
			[290, 120],
			[240, 90],
			[240, 90],
			[240, 90],
		],
		forearmL: [
			[240, 90],
			[240, 90],
			[240, 90],
			[180, 60],
			[180, 60],
			[180, 60],
			[130, 40],
			[130, 40],
			[130, 40],
		],
		forearmR: [
			[240, 90],
			[240, 90],
			[240, 90],
			[180, 60],
			[180, 60],
			[180, 60],
			[130, 40],
			[130, 40],
			[130, 40],
		],
	},
};

export class KokoroRig {
	private readonly nodes: SpriteNode[];
	private readonly verts: number[];
	private readonly origVerts: number[];
	private readonly vertsIdx: Record<BONE_NAME, { start: number; end: number }>;
	private readonly nodeRanges: Map<SpriteNode, { start: number; end: number }>;

	public readonly bounds: Record<
		BONE_NAME,
		{ minX: number; minY: number; w: number; h: number }
	>;
	public readonly grid: Record<BONE_NAME, Point[]>;

	private readonly vertToNode: SpriteNode[] = [];
	private readonly nodeOffsets: Map<SpriteNode, { x: number; y: number }> =
		new Map();

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

		this.bounds = {} as Record<
			BONE_NAME,
			{ minX: number; minY: number; w: number; h: number }
		>;
		this.grid = {} as Record<BONE_NAME, Point[]>;

		for (const node of this.nodes) {
			const range = this.nodeRanges.get(node);
			if (!range) continue;

			const ox = (node.sprite.x || 0) + (node.container.x || 0);
			const oy = (node.sprite.y || 0) + (node.container.y || 0);
			this.nodeOffsets.set(node, { x: ox, y: oy });

			for (let i = range.start; i < range.end; i += 2) {
				this.vertToNode[i] = node;
			}
		}

		for (const bone of BONE_LIST) {
			const { start, end } = this.vertsIdx[bone];
			this.grid[bone] = Array.from({ length: 9 }, () => [0, 0]);

			if (start === end) continue;

			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;
			let validVertsCount = 0;

			for (let i = start; i < end; i += 2) {
				const node = this.vertToNode[i];

				if (!node) continue;

				const offset = this.nodeOffsets.get(node) || { x: 0, y: 0 };
				const globalX = verts[i] + offset.x;
				const globalY = verts[i + 1] + offset.y;

				if (globalX < minX) minX = globalX;
				if (globalX > maxX) maxX = globalX;
				if (globalY < minY) minY = globalY;
				if (globalY > maxY) maxY = globalY;

				validVertsCount++;
			}

			if (validVertsCount > 0) {
				this.bounds[bone] = { minX, minY, w: maxX - minX, h: maxY - minY };
			}
		}

		app.ticker.add(() => this.tick());
	}

	public applyTemplate(name: string) {
		const tpl = POSE_TEMPLATES[name];
		if (!tpl) return;

		for (const bone of BONE_LIST) {
			const val = tpl[bone];
			const target = this.grid[bone];

			if (!val) {
				for (let i = 0; i < 9; i++) {
					target[i][0] = 0;
					target[i][1] = 0;
				}
				continue;
			}

			if (typeof val[0] === "number") {
				for (let i = 0; i < 9; i++) {
					target[i][0] = val[0] as number;
					target[i][1] = val[1] as number;
				}
			} else {
				for (let i = 0; i < 9; i++) {
					target[i][0] = (val[i] as Point)[0];
					target[i][1] = (val[i] as Point)[1];
				}
			}
		}
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
		for (const bone of BONE_LIST) {
			const { start, end } = this.vertsIdx[bone];

			if (start === end || !this.bounds[bone]) continue;

			const { minX, minY, w, h } = this.bounds[bone];
			const offsets = this.grid[bone];

			for (let i = start; i < end; i += 2) {
				const ox = this.origVerts[i];
				const oy = this.origVerts[i + 1];

				const node = this.vertToNode[i];

				if (!node) continue;

				const offset = this.nodeOffsets.get(node) || { x: 0, y: 0 };
				const globalX = ox + offset.x;
				const globalY = oy + offset.y;

				const u =
					w === 0 ? 0.5 : Math.max(0, Math.min(1, (globalX - minX) / w));
				const v =
					h === 0 ? 0.5 : Math.max(0, Math.min(1, (globalY - minY) / h));

				const wu = [(1 - u) ** 2, 2 * u * (1 - u), u ** 2];
				const wv = [(1 - v) ** 2, 2 * v * (1 - v), v ** 2];

				let dx = 0;
				let dy = 0;

				for (let row = 0; row < 3; row++) {
					for (let col = 0; col < 3; col++) {
						const weight = wu[col] * wv[row];
						const pt = offsets[row * 3 + col];
						dx += pt[0] * weight;
						dy += pt[1] * weight;
					}
				}

				this.verts[i] = ox + dx;
				this.verts[i + 1] = oy + dy;
			}
		}

		this.applyVerts();
	}
}
