import type * as PIXI from "pixi.js";
import type { SpriteNode } from "./loader";

export const FACE_LIST = ["pupilL", "pupilR", "eyeL", "eyeR", "mouth"] as const;
export type FACE_NAME = (typeof FACE_LIST)[number];

export type Transform = {
	tx: number;
	ty: number;
	rot: number;
	w: number;
};

export type PoseTransform = (u: number, v: number, t: number) => Transform;
export type Template = Record<string, PoseTransform>;

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

	private activeTransform: PoseTransform[] = [];

	private time: number = 0;

	constructor(
		app: PIXI.Application,
		nodes: SpriteNode[],
		options: KokoroRigOptions,
	) {
		const { poseTemplate, power = 1.0 } = options;
		this.template = poseTemplate;
		this.power = power;

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

		app.ticker.add((t) => {
			this.tick();
			this.time += t.deltaTime;
		});
	}

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

	public setPose(transform: PoseTransform[]) {
		this.activeTransform = transform;
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
		const fields = this.activeTransform;
		const total = this.origVerts.length / 2;

		for (let vi = 0; vi < total; vi++) {
			const gx = this.globalOrigVerts[vi * 2];
			const gy = this.globalOrigVerts[vi * 2 + 1];

			const u = (gx - this.minX) / this.w;
			const v = (gy - this.minY) / this.h;

			let totalTx = 0;
			let totalTy = 0;
			let totalRot = 0;

			for (const field of fields) {
				const t = field(u, v, this.time);
				const w = t.w;

				totalTx += t.tx * w;
				totalTy += t.ty * w;
				totalRot += t.rot * w;
			}

			const cos = Math.cos(totalRot);
			const sin = Math.sin(totalRot);

			const pivotX = this.minX + this.w / 2;
			const pivotY = this.minY + this.h;

			const x = gx - pivotX;
			const y = gy - pivotY;

			const rx = x * cos - y * sin;
			const ry = x * sin + y * cos;

			this.verts[vi * 2] = this.origVerts[vi * 2] + totalTx + rx * this.power;
			this.verts[vi * 2 + 1] =
				this.origVerts[vi * 2 + 1] + totalTy + ry * this.power;
		}

		this.applyVerts();
	}
}
