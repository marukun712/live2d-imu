import type * as PIXI from "pixi.js";
import type { KokoroGroup, SpriteNode } from "./loader";

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
	private swayTime = 0;
	private swayAmp = 0;

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

		app.ticker.add(() => this.tick());
	}

	public calcBlend(from: string, to: string, t: number): PoseField {
		const a = this.template[from];
		const b = this.template[to];
		return (u, v) => {
			const [ax, ay] = a ? a(u, v) : [0, 0];
			const [bx, by] = b ? b(u, v) : [0, 0];
			return [ax + (bx - ax) * t, ay + (by - ay) * t];
		};
	}

	public setPose(fields: PoseField[]) {
		this.activeFields = fields;
	}

	public updateSway() {
		this.swayAmp = 1;
	}

	private calcSway(): PoseField {
		this.swayAmp *= 0.95;
		this.swayTime += 0.05 * this.swayAmp;
		const t = this.swayTime;
		const a = this.swayAmp;
		return (_u, v) => {
			const influence = Math.max(0, 1 - v * 3.5);
			return [Math.sin(t + v * Math.PI * 2) * a * influence * 25, 0];
		};
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
		const fields = [...this.activeFields, this.calcSway()];
		const total = this.origVerts.length / 2;

		for (let vi = 0; vi < total; vi++) {
			const gx = this.globalOrigVerts[vi * 2];
			const gy = this.globalOrigVerts[vi * 2 + 1];
			const u = this.w === 0 ? 0.5 : (gx - this.minX) / this.w;
			const v = this.h === 0 ? 0.5 : (gy - this.minY) / this.h;

			for (const field of fields) {
				const [dx, dy] = field(u, v);
				this.verts[vi * 2] += dx * this.power;
				this.verts[vi * 2 + 1] += dy * this.power;
			}
		}

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
