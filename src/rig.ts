import type * as PIXI from "pixi.js";
import type { KokoroGroup, SpriteNode } from "./loader";

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

export const FACE_LIST = ["pupilL", "pupilR", "eyeL", "eyeR", "mouth"] as const;

export type BONE_NAME = (typeof BONE_LIST)[number];
export type FACE_NAME = (typeof FACE_LIST)[number];

export type Point = [number, number];
export type GridOffsets = Point | Point[];
export type Template = Record<string, Partial<Record<BONE_NAME, GridOffsets>>>;
export type TweenResult = Record<BONE_NAME, Point[]>;

export class KokoroRig {
	private readonly nodes: SpriteNode[];
	private readonly verts: number[];
	private readonly vertsIdx: Partial<
		Record<BONE_NAME, { start: number; end: number }>
	>;
	private readonly nodeRanges: Map<SpriteNode, { start: number; end: number }>;
	private readonly template: Template;
	private readonly power: number;

	private readonly origVerts: number[];
	public readonly bounds: Partial<
		Record<BONE_NAME, { minX: number; minY: number; w: number; h: number }>
	>;
	public readonly grid: Partial<Record<BONE_NAME, Point[]>>;

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
		vertsIdx: Partial<Record<BONE_NAME, { start: number; end: number }>>,
		nodeRanges: Map<SpriteNode, { start: number; end: number }>,
		template: Template,
		power: number,
	) {
		this.nodes = nodes;
		this.verts = verts;
		this.origVerts = [...verts];
		this.vertsIdx = vertsIdx;
		this.nodeRanges = nodeRanges;
		this.template = template;
		this.power = power;

		this.bounds = {};
		this.grid = {};

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
			if (!this.vertsIdx[bone]) continue;
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

			const tplA = this.template[from];
			const tplB = this.template[to];

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
	public blendTweens(inputs: TweenResult[], power: number) {
		for (const bone of BONE_LIST) {
			const target = this.grid[bone];

			if (!target) continue;

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
		this.swayAmp *= 0.95;
		this.swayTime += 0.05 * this.swayAmp;

		const result = {} as TweenResult;
		for (const bone of BONE_LIST)
			result[bone] = Array.from({ length: 9 }, () => [0, 0] as Point);

		for (const bone of ["hairFront", "hairSide", "hairBack"] as BONE_NAME[]) {
			for (let row = 0; row < 3; row++) {
				const s = Math.sin(this.swayTime + row) * this.swayAmp * (row / 2) * 20;
				for (let col = 0; col < 3; col++) result[bone][row * 3 + col][0] = s;
			}
		}
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
		this.blendTweens([...this.lastTweens, this.calcSway()], this.power);

		for (const bone of BONE_LIST) {
			if (!this.vertsIdx[bone]) continue;
			const { start, end } = this.vertsIdx[bone];

			if (start === end || !this.bounds[bone]) continue;

			// ボーンの境界を取得
			const { minX, minY, w, h } = this.bounds[bone];
			// ボーンのオフセットを取得
			const offsets = this.grid[bone];
			if (!offsets) continue;

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

export class KokoroFace {
	private readonly groups: Partial<Record<FACE_NAME, KokoroGroup>>;

	constructor(groups: Partial<Record<FACE_NAME, KokoroGroup>>) {
		this.groups = groups;

		for (const group of Object.values(groups)) {
			for (const node of group.nodes) {
				const cx = node.sprite.x + node.sprite.texture.width / 2;
				const cy = node.sprite.y + node.sprite.texture.height / 2;
				node.container.pivot.set(cx, cy);
				node.container.position.set(cx, cy);
			}
		}
	}

	setFocus(x: number, y: number) {
		const dx = (x - 0.5) * 40;
		const dy = (y - 0.5) * 20;
		const lGroup = this.groups.pupilL;
		const rGroup = this.groups.pupilR;
		if (!lGroup || !rGroup) return;
		for (const node of [...lGroup.nodes, ...rGroup.nodes]) {
			node.container.x = node.container.pivot.x + dx;
			node.container.y = node.container.pivot.y + dy;
		}
	}

	setOpenMouth(t: number) {
		const mouth = this.groups.mouth;
		if (!mouth) return;
		mouth.scaleY = t;
	}

	setOpenEyeL(t: number) {
		const eye = this.groups.eyeL;
		const pupil = this.groups.pupilL;
		if (!eye || !pupil) return;

		eye.scaleY = t;
		pupil.scaleY = t;
	}

	setOpenEyeR(t: number) {
		const eye = this.groups.eyeR;
		const pupil = this.groups.pupilR;
		if (!eye || !pupil) return;

		eye.scaleY = t;
		pupil.scaleY = t;
	}

	setScaleEyeL(s: number) {
		const eye = this.groups.eyeL;
		const pupil = this.groups.pupilL;
		if (!eye || !pupil) return;

		eye.scaleX = s;
		eye.scaleY = s;
		pupil.scaleX = s;
		pupil.scaleY = s;
	}

	setScaleEyeR(s: number) {
		const eye = this.groups.eyeR;
		const pupil = this.groups.pupilR;
		if (!eye || !pupil) return;

		eye.scaleX = s;
		eye.scaleY = s;
		pupil.scaleX = s;
		pupil.scaleY = s;
	}
}
