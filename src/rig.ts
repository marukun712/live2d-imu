import type * as PIXI from "pixi.js";
import type { SpriteNode } from "./loader";

export const FACE_LIST = ["pupilL", "pupilR", "eyeL", "eyeR", "mouth"] as const;
export type FACE_NAME = (typeof FACE_LIST)[number];
export type Point = [number, number];
export type PoseField = (u: number, v: number) => Point;
export type Template = Record<string, PoseField>;

export interface KokoroRigOptions {
	poseTemplate: Template;
	power?: number;
}

export class KokoroRig {
	private readonly template: Template;
	private readonly power: number;

	private readonly origVerts: Float32Array;
	private readonly globalOrigVerts: Float32Array;
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

	private activeFields: PoseField[] = [];

	constructor(
		app: PIXI.Application,
		nodes: SpriteNode[],
		options: KokoroRigOptions,
	) {
		const { poseTemplate, power = 1.0 } = options;
		this.template = poseTemplate;
		this.power = power;

		// nodeと頂点範囲の対応付け
		let total = 0;
		for (const node of nodes) {
			const count =
				(node.sprite.geometry.getBuffer("aPosition").data as Float32Array)
					.length / 2;
			this.nodeRanges.push({ node, start: total, end: total + count });
			total += count;
		}

		// 配列の初期化
		this.origVerts = new Float32Array(total * 2);
		this.globalOrigVerts = new Float32Array(total * 2);
		this.verts = new Float32Array(total * 2);

		// 初期状態の頂点配列とグローバル座標を保存
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

		// 画像の縦横と最大値を求める
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (let vi = 0; vi < total; vi++) {
			const gx = this.globalOrigVerts[vi * 2];
			const gy = this.globalOrigVerts[vi * 2 + 1];
			if (gx < minX) minX = gx;
			if (gx > maxX) maxX = gx;
			if (gy < minY) minY = gy;
			if (gy > maxY) maxY = gy;
		}
		this.minX = minX;
		this.minY = minY;
		this.w = maxX - minX;
		this.h = maxY - minY;

		app.ticker.add(() => this.tick());
	}

	public lerpBlend(from: string, to: string, t: number): PoseField {
		const a = this.template[from];
		const b = this.template[to];
		return (u, v) => {
			const [ax, ay] = a(u, v);
			const [bx, by] = b(u, v);
			return [ax + (bx - ax) * t, ay + (by - ay) * t];
		};
	}

	public setPose(fields: PoseField[]) {
		this.activeFields = fields;
	}

	private applyVerts() {
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

	private tick() {
		this.verts.set(this.origVerts);
		const fields = this.activeFields;
		const total = this.origVerts.length / 2;

		for (let vi = 0; vi < total; vi++) {
			const gx = this.globalOrigVerts[vi * 2];
			const gy = this.globalOrigVerts[vi * 2 + 1];
			const u = (gx - this.minX) / this.w;
			const v = (gy - this.minY) / this.h;

			for (const field of fields) {
				const [dx, dy] = field(u, v);
				this.verts[vi * 2] += dx * this.power;
				this.verts[vi * 2 + 1] += dy * this.power;
			}
		}

		this.applyVerts();
	}
}
