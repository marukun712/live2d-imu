import type * as PIXI from "pixi.js";
import type { SpriteNode } from "./loader";

export const BONE_LIST = [
	"head",
	"body",
	"chest",
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
export type TweenResult = Record<BONE_NAME, Point[]>;

export const POSE_TEMPLATES: Template = {
	normal: {},
	left: {
		head: [-20, 0],
		hairFront: [-40, 0],
		hairSide: [-30, 0],
		hairBack: [20, 0],
		body: [-10, 0],
		chest: [-10, 0],
		legs: [-20, 0],
	},
	right: {
		head: [20, 0],
		hairFront: [40, 0],
		hairSide: [30, 0],
		hairBack: [-20, 0],
		body: [10, 0],
		chest: [10, 0],
		legs: [20, 0],
	},
	up: {
		head: [0, -40],
		hairFront: [0, -60],
		hairSide: [0, -50],
		hairBack: [0, -30],
		body: [0, -20],
		chest: [0, -20],
		legs: [0, -10],
	},
	down: {
		head: [0, 40],
		hairFront: [0, 60],
		hairSide: [0, 50],
		hairBack: [0, 30],
		body: [0, 20],
		chest: [0, 20],
		legs: [0, 10],
	},
	leanLeft: {
		head: [
			[-140, 55],
			[-140, 0],
			[-140, -55],
			[-110, 45],
			[-110, 0],
			[-110, -45],
			[-80, 35],
			[-80, 0],
			[-80, -35],
		],
		body: [
			[-50, 15],
			[-50, 0],
			[-50, -15],
			[-25, 5],
			[-25, 0],
			[-25, -5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		chest: [
			[-80, 35],
			[-80, 0],
			[-80, -35],
			[-65, 25],
			[-65, 0],
			[-65, -25],
			[-50, 15],
			[-50, 0],
			[-50, -15],
		],
		upperArmL: [
			[-80, 35],
			[-80, 35],
			[-80, 35],
			[-65, 25],
			[-65, 25],
			[-65, 25],
			[-50, 15],
			[-50, 15],
			[-50, 15],
		],
		forearmL: [
			[-50, 15],
			[-50, 15],
			[-50, 15],
			[-25, 5],
			[-25, 5],
			[-25, 5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		upperArmR: [
			[-80, -35],
			[-80, -35],
			[-80, -35],
			[-50, -20],
			[-50, -20],
			[-50, -20],
			[-20, -10],
			[-20, -10],
			[-20, -10],
		],
		forearmR: [
			[-20, -10],
			[-20, -10],
			[-20, -10],
			[-10, -5],
			[-10, -5],
			[-10, -5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		legs: [
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		hairFront: [
			[-160, 65],
			[-160, 0],
			[-160, -65],
			[-120, 50],
			[-120, 0],
			[-120, -50],
			[-80, 35],
			[-80, 0],
			[-80, -35],
		],
		hairSide: [
			[-140, 55],
			[-140, 0],
			[-140, -55],
			[-110, 45],
			[-110, 0],
			[-110, -45],
			[-80, 35],
			[-80, 0],
			[-80, -35],
		],
		hairBack: [
			[-120, 45],
			[-120, 0],
			[-120, -45],
			[-100, 40],
			[-100, 0],
			[-100, -40],
			[-80, 35],
			[-80, 0],
			[-80, -35],
		],
	},
	leanRight: {
		head: [
			[140, -55],
			[140, 0],
			[140, 55],
			[110, -45],
			[110, 0],
			[110, 45],
			[80, -35],
			[80, 0],
			[80, 35],
		],
		body: [
			[50, -15],
			[50, 0],
			[50, 15],
			[25, -5],
			[25, 0],
			[25, 5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		chest: [
			[80, -35],
			[80, 0],
			[80, 35],
			[65, -25],
			[65, 0],
			[65, 25],
			[50, -15],
			[50, 0],
			[50, 15],
		],
		upperArmL: [
			[80, -35],
			[80, -35],
			[80, -35],
			[50, -20],
			[50, -20],
			[50, -20],
			[20, -10],
			[20, -10],
			[20, -10],
		],
		forearmL: [
			[20, -10],
			[20, -10],
			[20, -10],
			[10, -5],
			[10, -5],
			[10, -5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		upperArmR: [
			[80, 35],
			[80, 35],
			[80, 35],
			[65, 25],
			[65, 25],
			[65, 25],
			[50, 15],
			[50, 15],
			[50, 15],
		],
		forearmR: [
			[50, 15],
			[50, 15],
			[50, 15],
			[25, 5],
			[25, 5],
			[25, 5],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		legs: [
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
		],
		hairFront: [
			[160, -65],
			[160, 0],
			[160, 65],
			[120, -50],
			[120, 0],
			[120, 50],
			[80, -35],
			[80, 0],
			[80, 35],
		],
		hairSide: [
			[140, -55],
			[140, 0],
			[140, 55],
			[110, -45],
			[110, 0],
			[110, 45],
			[80, -35],
			[80, 0],
			[80, 35],
		],
		hairBack: [
			[120, -45],
			[120, 0],
			[120, 45],
			[100, -40],
			[100, 0],
			[100, 40],
			[80, -35],
			[80, 0],
			[80, 35],
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

	private lastTweens: TweenResult[] = [];

	private swayTime = 0;
	private swayAmp = 0;

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

		// 全ノードのx,yを取得して、verts番号と紐づけ
		for (const node of this.nodes) {
			const range = this.nodeRanges.get(node);
			if (!range) continue;

			const ox = (node.sprite.x || 0) + (node.container.x || 0);
			const oy = (node.sprite.y || 0) + (node.container.y || 0);
			// 後でずらすときに使う
			this.nodeOffsets.set(node, { x: ox, y: oy });

			for (let i = range.start; i < range.end; i += 2) {
				this.vertToNode[i] = node;
			}
		}

		for (const bone of BONE_LIST) {
			// 各ボーンの開始index番号を取得
			const { start, end } = this.vertsIdx[bone];
			// 3x3グリッドの初期化
			this.grid[bone] = Array.from({ length: 9 }, () => [0, 0]);

			if (start === end) continue;

			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;
			let validVertsCount = 0;

			// x,yの最大値をそれぞれ求める(offsetを足してglobal座標に)
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

			// 各ボーンの境界線を記録
			if (validVertsCount > 0) {
				this.bounds[bone] = { minX, minY, w: maxX - minX, h: maxY - minY };
			}
		}

		app.ticker.add(() => this.tick());
	}

	public calcTween(from: string, to: string, t: number): TweenResult {
		const result = {} as TweenResult;

		for (const bone of BONE_LIST) {
			const target = Array.from({ length: 9 }, () => [0, 0] as Point);
			result[bone] = target;

			const tplA = POSE_TEMPLATES[from];
			const tplB = POSE_TEMPLATES[to];

			const a = tplA?.[bone];
			const b = tplB?.[bone];

			// 一点または一括で適用
			for (let i = 0; i < 9; i++) {
				const ax = !a
					? 0
					: typeof a[0] === "number"
						? (a[0] as number)
						: (a[i] as Point)[0];
				const ay = !a
					? 0
					: typeof a[0] === "number"
						? (a[1] as number)
						: (a[i] as Point)[1];
				const bx = !b
					? 0
					: typeof b[0] === "number"
						? (b[0] as number)
						: (b[i] as Point)[0];
				const by = !b
					? 0
					: typeof b[0] === "number"
						? (b[1] as number)
						: (b[i] as Point)[1];

				// lerp
				target[i][0] = ax + (bx - ax) * t;
				target[i][1] = ay + (by - ay) * t;
			}
		}

		return result;
	}

	public setPose(tweens: TweenResult[]) {
		this.lastTweens = tweens;
	}

	// tweenをブレンドする
	public blendTweens(inputs: TweenResult[], power?: number) {
		for (const bone of BONE_LIST) {
			const target = this.grid[bone];

			for (let i = 0; i < 9; i++) {
				target[i][0] = 0;
				target[i][1] = 0;
			}

			for (const grid of inputs) {
				const src = grid[bone];

				for (let i = 0; i < 9; i++) {
					target[i][0] += src[i][0] * (power ?? 1);
					target[i][1] += src[i][1] * (power ?? 1);
				}
			}
		}
	}

	public updateSway() {
		this.swayAmp = 1;
	}

	public calcSway() {
		this.swayAmp *= 0.97;
		this.swayTime += 0.06 * this.swayAmp;

		const result = {} as TweenResult;
		for (const bone of BONE_LIST)
			result[bone] = Array.from({ length: 9 }, () => [0, 0] as Point);

		for (const bone of ["hairFront", "hairSide", "hairBack"] as BONE_NAME[]) {
			for (let row = 0; row < 3; row++) {
				const s = Math.sin(this.swayTime + row) * this.swayAmp * (row / 2) * 24;
				for (let col = 0; col < 3; col++) result[bone][row * 3 + col][0] = s;
			}
		}
		for (let i = 0; i < 9; i++)
			result.chest[i][1] = Math.sin(this.swayTime) * this.swayAmp * 2;

		return result;
	}

	// meshの頂点配列をrig内の頂点配列でreplace
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
		this.blendTweens([...this.lastTweens, this.calcSway()], 1.5);

		for (const bone of BONE_LIST) {
			const { start, end } = this.vertsIdx[bone];

			if (start === end || !this.bounds[bone]) continue;

			// ボーンの境界を取得
			const { minX, minY, w, h } = this.bounds[bone];
			// ボーンのオフセットを取得
			const offsets = this.grid[bone];

			for (let i = start; i < end; i += 2) {
				// 初期位置を取得
				const ox = this.origVerts[i];
				const oy = this.origVerts[i + 1];

				// 頂点番号からノードを取得
				const node = this.vertToNode[i];

				if (!node) continue;

				// グローバル座標に変換
				const offset = this.nodeOffsets.get(node) || { x: 0, y: 0 };
				const globalX = ox + offset.x;
				const globalY = oy + offset.y;

				// 0~1にする
				const u =
					w === 0 ? 0.5 : Math.max(0, Math.min(1, (globalX - minX) / w));
				const v =
					h === 0 ? 0.5 : Math.max(0, Math.min(1, (globalY - minY) / h));

				// ベジエ曲面で重みを求める
				const wu = [(1 - u) ** 2, 2 * u * (1 - u), u ** 2];
				const wv = [(1 - v) ** 2, 2 * v * (1 - v), v ** 2];

				let dx = 0;
				let dy = 0;

				// 各点に重みをかける
				for (let row = 0; row < 3; row++) {
					for (let col = 0; col < 3; col++) {
						const weight = wu[col] * wv[row];
						const pt = offsets[row * 3 + col];
						dx += pt[0] * weight;
						dy += pt[1] * weight;
					}
				}

				// x,yを置き換え
				this.verts[i] = ox + dx;
				this.verts[i + 1] = oy + dy;
			}
		}

		// 適用
		this.applyVerts();
	}
}
