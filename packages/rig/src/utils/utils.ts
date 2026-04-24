import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

/** UV -> 変形量のイージング関数を格納する辞書型 */
type Curve = Record<
	"body" | "upperBody" | "head" | "hair" | "chest",
	(t: number) => number
>;

/**
 * キャラクター各部位の変形量を UV 座標から決定するイージング関数群
 */
export const curve: Curve = {
	body: gsap.parseEase("power1.in"),
	upperBody: gsap.parseEase("power2.in"),
	head: gsap.parseEase("power3.in"),
	hair: gsap.parseEase("power4.in"),
	chest: gsap.parseEase(
		CustomEase.create("custom", "M0,0 C0.35,0 0.55,1 0.6,1 0.7,1 0.8,0 1,0"),
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
