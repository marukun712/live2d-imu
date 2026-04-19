import type * as PIXI from "pixi.js";
import type { SpriteNode } from "../image/psd";
import type { Bounds } from "./matcher";

/** 1フレームの変形量 */
export interface Transform {
	/** X 方向の平行移動量 (ピクセル) */
	tx: number;
	/** Y 方向の平行移動量 (ピクセル) */
	ty: number;
	/** 回転角 (ラジアン) */
	rot: number;
	/** この変形のウェイト(0~1) */
	w: number;
}

/**
 * UV 座標と時間から {@link Transform} を返す関数。
 *
 * @param u - 水平方向の正規化座標 (0=左, 1=右)
 * @param v - 垂直方向の正規化座標 (0=上, 1=下)
 * @param t - 経過時間
 */
export type PoseTransform = (u: number, v: number, t: number) => Transform;

/**
 * ポーズ名をキーとする {@link PoseTransform} の辞書。
 * {@link KokoroRig.lerpBlend} で補間して使う。
 */
export type Template = Record<string, PoseTransform>;

/** {@link KokoroRig} コンストラクタのオプション */
export interface KokoroRigOptions {
	/** 使用するポーズテンプレート */
	poseTemplate: Template;
	/** メッシュ変形の基準となる AABB */
	bounds: Bounds;
	/**
	 * 変形倍率。デフォルトは `1.0`。
	 */
	power?: number;
	/**
	 * 親リグ。指定すると親の activeTransform も合成される。
	 * 部位ごとに独立したリグを作りつつ、ルートリグの動きを継承させたい場合に使う。
	 */
	parent?: KokoroRig;
}

/**
 * PIXI.MeshPlane の頂点を毎フレーム書き換えることで
 * キャラクターの体幹・髪・腕などをソフトボディ的に変形させるリグ。
 */
export class KokoroRig {
	private readonly template: Template;
	private readonly power: number;

	/** ローカル座標の初期頂点バッファ */
	private readonly origVerts: Float32Array;
	/** ワールド座標の初期頂点バッファ */
	private readonly globalOrigVerts: Float32Array;
	/** 変形後の頂点バッファ */
	private readonly verts: Float32Array;

	private readonly nodeRanges: Array<{
		node: SpriteNode;
		start: number;
		end: number;
	}> = [];

	private readonly minX: number;
	private readonly minY: number;
	private readonly w: number;
	private readonly h: number;

	/** 現フレームに適用する変形関数リスト */
	public activeTransform: PoseTransform[] = [];
	private readonly parent?: KokoroRig;
	private time = 0;

	constructor(
		app: PIXI.Application,
		nodes: SpriteNode[],
		options: KokoroRigOptions,
	) {
		const { poseTemplate, bounds, power = 1.0, parent } = options;
		this.template = poseTemplate;
		this.power = power;
		this.parent = parent;

		// 全ノードの頂点数を集計してバッファを確保
		let total = 0;
		for (const node of nodes) {
			const count =
				(node.sprite.geometry.getBuffer("aPosition").data as Float32Array)
					.length / 2;
			this.nodeRanges.push({ node, start: total, end: total + count });
			total += count;
		}

		this.origVerts = new Float32Array(total * 2);
		this.globalOrigVerts = new Float32Array(total * 2);
		this.verts = new Float32Array(total * 2);

		// 初期頂点を記録
		for (const { node, start, end } of this.nodeRanges) {
			const data = node.sprite.geometry.getBuffer("aPosition")
				.data as Float32Array;
			const ox = node.sprite.x + node.container.x;
			const oy = node.sprite.y + node.container.y;
			for (let vi = start; vi < end; vi++) {
				const li = vi - start;
				this.origVerts[vi * 2] = data[li * 2];
				this.origVerts[vi * 2 + 1] = data[li * 2 + 1];
				this.globalOrigVerts[vi * 2] = data[li * 2] + ox;
				this.globalOrigVerts[vi * 2 + 1] = data[li * 2 + 1] + oy;
			}
		}

		this.verts.set(this.origVerts);
		this.minX = bounds.minX;
		this.minY = bounds.minY;
		this.w = bounds.w;
		this.h = bounds.h;

		app.ticker.add((t) => {
			this.tick();
			this.time += t.deltaTime;
		});
	}

	/**
	 * テンプレート内の2つのポーズを線形補間した {@link PoseTransform} を返す。
	 * 戻り値をそのまま {@link setPose} に渡すことができる。
	 *
	 * @param from - 補間開始のポーズ名 (t=0 側)
	 * @param to   - 補間終了のポーズ名 (t=1 側)
	 * @param t    - 補間係数 (0~1)
	 */
	public lerpBlend(from: string, to: string, t: number): PoseTransform {
		const a = this.template[from];
		const b = this.template[to];
		return (u, v) => {
			const ta = a(u, v, this.time);
			const tb = b(u, v, this.time);
			return {
				tx: ta.tx + (tb.tx - ta.tx) * t,
				ty: ta.ty + (tb.ty - ta.ty) * t,
				rot: ta.rot + (tb.rot - ta.rot) * t,
				w: ta.w + (tb.w - ta.w) * t,
			};
		};
	}

	/**
	 * 次フレームから適用するポーズをセットする。
	 * 複数渡した場合はウェイト加算で合成される。
	 *
	 * @param transforms - 適用する {@link PoseTransform} の配列
	 */
	public setPose(transforms: PoseTransform[]): void {
		this.activeTransform = transforms;
	}

	/** 変形済みバッファをメッシュに書き戻す */
	private applyVerts(): void {
		for (const { node, start, end } of this.nodeRanges) {
			const buffer = node.sprite.geometry.getBuffer("aPosition");
			const data = buffer.data as Float32Array;
			for (let vi = start; vi < end; vi++) {
				data[(vi - start) * 2] = this.verts[vi * 2];
				data[(vi - start) * 2 + 1] = this.verts[vi * 2 + 1];
			}
			buffer.update();
		}
	}

	/** 毎フレーム呼ばれる頂点変形処理 */
	private tick(): void {
		const fields = [
			...(this.parent?.activeTransform ?? []),
			...this.activeTransform,
		];
		const total = this.origVerts.length / 2;

		for (let vi = 0; vi < total; vi++) {
			const gx = this.globalOrigVerts[vi * 2];
			const gy = this.globalOrigVerts[vi * 2 + 1];

			// UV 座標に正規化
			const u = (gx - this.minX) / this.w;
			const v = (gy - this.minY) / this.h;

			let totalTx = 0,
				totalTy = 0,
				totalRot = 0;
			for (const field of fields) {
				const tr = field(u, v, this.time);
				totalTx += tr.tx * tr.w;
				totalTy += tr.ty * tr.w;
				totalRot += tr.rot * tr.w;
			}

			const cos = Math.cos(totalRot);
			const sin = Math.sin(totalRot);

			// ピボットを胴体下端中央に設定
			const pivotX = this.minX + this.w / 2;
			const pivotY = this.minY + this.h;

			const x = gx - pivotX;
			const y = gy - pivotY;

			this.verts[vi * 2] =
				this.origVerts[vi * 2] + totalTx + (x * cos - y * sin) * this.power;
			this.verts[vi * 2 + 1] =
				this.origVerts[vi * 2 + 1] + totalTy + (x * sin + y * cos) * this.power;
		}

		this.applyVerts();
	}
}
