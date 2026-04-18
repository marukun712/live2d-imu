import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

type Curve = Record<string, (t: number) => number>;

/**
 * キャラクター各部位の変形量を UV 座標から決定するイージング関数群
 */
export const curve: Curve = {
	power1: gsap.parseEase("power1.in"),
	power2: gsap.parseEase("power2.in"),
	power3: gsap.parseEase("power3.in"),
	power4: gsap.parseEase("power4.in"),
	inOut: gsap.parseEase("sine.inOut"),
	head: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.774,-0.003 0.774,-0.003 0.774,-0.003 0.882,0.996 1,0.996",
		),
	),
	body: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.4,-0.003 0.4,-0.003 0.4,-0.003 0.882,0.996 1,0.996",
		),
	),
	chest: gsap.parseEase(
		CustomEase.create("custom", "M0,0 C0.35,0 0.55,1 0.6,1 0.7,1 0.8,0 1,0"),
	),
	hair: CustomEase.create(
		"custom",
		"M0,0 C0.067,0.132 0.336,0.049 0.6,0.3 0.742,0.436 0.822,1 1,1",
	),
} as const;

/** {@link getSpatialParams} の戻り値 */
export interface SpatialParams {
	fromTop: number;
	fromBottom: number;
	fromLeft: number;
	fromCenterX: number;
	fromCenterY: number;
	isUpperBody: boolean;
}

/**
 * UV 座標から各種空間パラメータを計算する。
 * PoseTransform 内でウェイト計算に使う。
 *
 * @param u - 水平方向の正規化座標 (0=左, 1=右)
 * @param v - 垂直方向の正規化座標 (0=上, 1=下)
 */
export function getSpatialParams(u: number, v: number): SpatialParams {
	return {
		fromTop: 1 - v,
		fromBottom: v,
		fromLeft: u,
		fromCenterX: u - 0.5,
		fromCenterY: Math.abs(0.5 - v) * 2,
		isUpperBody: v < 0.5,
	};
}

/**
 * 円柱を水平回転させたときの各 X 位置の変位ウェイトを計算する。
 * キャラクターを立体的に左右回転させる際に使用する。
 *
 * @param u     - 水平方向の正規化座標 (0=左, 1=右)
 * @param angle - 回転角度(ラジアン)。正で右回転
 * @param fov - 視野角
 * @returns 変位ウェイト
 */
export function getCylinderWeight(
	u: number,
	angle: number,
	fov: number = Math.PI,
): number {
	const theta = (u - 0.5) * fov;
	const origX = Math.sin(theta);
	const newX = Math.sin(theta + angle);
	const centerDiff = Math.sin(angle);
	return (newX - origX) / centerDiff;
}
