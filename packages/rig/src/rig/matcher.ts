import type { SpriteNode } from "../image/psd";

/** 複数の {@link SpriteNode} をまとめて操作するグループ */
export interface KokoroGroup {
	/** グループに含まれるノード一覧 */
	nodes: SpriteNode[];
	/** 全ノードの X 座標 */
	x: number;
	/** 全ノードの Y 座標 */
	y: number;
	/** 全ノードのアルファ値 */
	alpha: number;
	/** 全ノードの表示状態 */
	visible: boolean;
	/** 全ノードの X スケール */
	scaleX: number;
	/** 全ノードの Y スケール */
	scaleY: number;
}

/** {@link GroupMatcher} に渡せる最小限のノード情報 */
export type Matchable = { name: string; path: string[] };

/**
 * ノードがグループに属するかを判定する関数。
 * {@link groupNodes} や {@link walkPSD} の絞り込み条件として使用する。
 */
export type GroupMatcher = (node: Matchable) => boolean;

/** ノード群の AABB */
export interface Bounds {
	/** 最小 X */
	minX: number;
	/** 最小 Y */
	minY: number;
	/** 横幅 */
	w: number;
	/** 縦幅 */
	h: number;
}

/**
 * {@link GroupMatcher} でフィルタしたノードを {@link KokoroGroup} にまとめる。
 * x / y / alpha などのプロパティを変更すると全ノードの Container に一括反映される。
 *
 * @param nodes - 全ノード
 * @param matcher - 絞り込み条件
 * @returns {@link KokoroGroup}
 */
export function groupNodes(
	nodes: SpriteNode[],
	matcher: GroupMatcher,
): KokoroGroup {
	const matched = nodes.filter(matcher);
	const containers = matched.map((n) => n.container);

	return {
		nodes: matched,
		get x() {
			return containers[0]?.x ?? 0;
		},
		set x(v) {
			containers.forEach((c) => {
				c.x = v;
			});
		},
		get y() {
			return containers[0]?.y ?? 0;
		},
		set y(v) {
			containers.forEach((c) => {
				c.y = v;
			});
		},
		get alpha() {
			return containers[0]?.alpha ?? 1;
		},
		set alpha(v) {
			containers.forEach((c) => {
				c.alpha = v;
			});
		},
		get visible() {
			return containers[0]?.visible ?? true;
		},
		set visible(v) {
			containers.forEach((c) => {
				c.visible = v;
			});
		},
		get scaleX() {
			return containers[0]?.scale.x ?? 1;
		},
		set scaleX(v) {
			containers.forEach((c) => {
				c.scale.x = v;
			});
		},
		get scaleY() {
			return containers[0]?.scale.y ?? 1;
		},
		set scaleY(v) {
			containers.forEach((c) => {
				c.scale.y = v;
			});
		},
	};
}

/**
 * レイヤー名が完全一致するノードにマッチする。
 *
 * @param name - 対象のレイヤー名
 */
export function byName(name: string): GroupMatcher {
	return (n) => n.name === name;
}

/**
 * パスの末尾が指定した配列と一致するノードにマッチする。
 *
 * @example
 * byPath(["body", "arm"]) // path が [..., "body", "arm"] で終わるノード
 */
export function byPath(path: string[]): GroupMatcher {
	return (n) =>
		path.every((seg, i) => n.path[n.path.length - path.length + i] === seg);
}

/**
 * 指定したグループ名をパスに含み、除外グループを含まないノードにマッチする。
 *
 * @param groupName - 含むべきグループ名
 * @param negative  - 除外するグループ名の配列
 */
export function psdGroup(groupName: string, negative?: string[]): GroupMatcher {
	return (n) =>
		n.path.includes(groupName) &&
		!negative?.some((neg) => n.path.includes(neg));
}

/**
 * 複数の {@link GroupMatcher} を結合する。
 * いずれか1つでも true を返せばマッチとみなす。
 *
 * @param matchers - 結合する matcher の配列
 */
export function pipe(...matchers: GroupMatcher[]): GroupMatcher {
	return (n) => matchers.some((m) => m(n));
}
