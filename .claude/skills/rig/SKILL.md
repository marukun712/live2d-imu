# SKILL: KokoroRig PSD Layer Mapping

## 概要

このスキルは、PSDファイルを読み込んだキャラクターリグに対して、以下の3つの定義を正しく記述するためのガイドです。

1. **`SKIP`** — `walkPSD` でスキップする個別レイヤー名のセット
2. **`rigNodes` の第2引数 (RigMap)** — 頂点変形ボーンへのレイヤーマッピング
3. **`groupNodes` の第2引数 (GroupMap)** — 表情パーツの表示制御マッピング

---

## 前提知識

### 使用できるマッチャー関数

```ts
byName(name: string)         // レイヤー名が完全一致
byPath(path: string[])       // パスの末尾がすべて一致
psdGroup(group, negative?)   // pathにgroupを含む。negativeを含むものは除外
pipe(...matchers)            // いずれかにマッチ（OR結合）
```

### BONE_NAME の一覧（rigNodes 用）

```ts
"head" | "body" | "chest" |
"forearmL" | "upperArmL" | "forearmR" | "upperArmR" |
"legs" | "hairFront" | "hairSide" | "hairBack"
```

### FACE_NAME の一覧（groupNodes 用）

```ts
"pupilL" | "pupilR" | "eyeL" | "eyeR" | "mouth"
```

### 型の定義

```ts
type RigMap   = Record<BONE_NAME, GroupMatcher>  // rigNodes に渡す
type GroupMap = Record<FACE_NAME, GroupMatcher>  // groupNodes に渡す
```

- `RigMap` はすべての `BONE_NAME` キーを埋める必要があります
- `GroupMap` はすべての `FACE_NAME` キーを埋める必要があります
- マッチするレイヤーがない場合は `() => false`

---

## STEP 1: PSDのレイヤー構造を把握する

以下のコマンドを実行してツリー構造を確認する。

```sh
bun psd
```

**出力から読み取るべき点:**
- `📁` がグループ（フォルダ）= `psdGroup()` のグループ名として使える
- `🖼` が末端レイヤー（表示中）= `byName()` で直接指定できる
- `👻` が末端レイヤー（PSD上で非表示）= `walkPSD` では読み込まれないため、`SKIP`に入れる必要はない
- `🖼` が複数並んでいる差分グループは、使わないものを `SKIP` に入れる必要がある
- 背景レイヤーの有無を確認する

---

## STEP 2: SKIP セットを定義する

### 目的
`SKIP` に指定した名前のレイヤーは `walkPSD` で読み込まれず、描画・変形の対象から外れる。
**用途はPSDごとに異なる**ため、ツリーを見て判断する。

### 典型的な用途

| 状況 | 対処 |
|------|------|
| 差分レイヤーが複数デフォルトでアクティブになっている | 使わない差分レイヤー名を `SKIP` に列挙して非表示にする |
| 背景レイヤーが含まれている | 背景グループ・レイヤー名を `SKIP` に追加する |
| 制作用ガイド・クレジット等が含まれている | 同様に `SKIP` に追加する |

### 差分レイヤーの見分け方

同じグループ内に `🖼` が複数並んでいる場合、それらは差分（バリエーション）の可能性が高い。
PSDの制作慣習として、差分は通常どれか1つだけ表示される想定で重ねられている。
**`🖼` が並んでいたらすべて読み込まれている**ので、使わないものは明示的に `SKIP` に入れる必要がある。

```
📁 口
├─ 🖼 口_開き      ← これだけ使いたい
├─ 🖼 口_閉じ      ← SKIP に追加
└─ 🖼 口_笑い      ← SKIP に追加
```

### ルール
- グループ名を指定するとその子レイヤーごとすべて除外される
- 個別のレイヤー名を指定することも可能

```ts
const SKIP = new Set([
  "レイヤー名A",  // 使わない差分
  "レイヤー名B",  // 背景など
  // bun psd の出力を見て、描画不要なものを列挙する
]);
```

---

## STEP 3: rigNodes の RigMap を定義する

### 目的
各ボーンが**どのレイヤー群の頂点を変形するか**を定義する。

### ルール
1. **すべての `BONE_NAME` キーを記述する**（未定義はエラー）
2. 各ボーンには、変形させたいレイヤー群にマッチするマッチャーを設定する
3. マッチするレイヤーがない場合は `() => false`
4. 複数グループをまとめる場合は `pipe()` でOR結合する
5. 除外したい子グループがある場合は `psdGroup(group, ["除外グループ名"])` を使う

### ボーン別 対応指針

| ボーン | 対応する部位 | マッチャーの選び方 |
|--------|------------|------------------|
| `head` | 顔・頭部全体・付属品 | 顔グループ・耳・帽子などを `pipe()` でまとめる |
| `body` | 胴体（他ボーンと重複する子グループは除外） | `psdGroup("胴体グループ", ["除外する子グループ"])` |
| `chest` | 胸部 | 胸グループを `psdGroup()` で指定 |
| `upperArmL` | 左上腕（単体レイヤーのことが多い） | `byName()` で直接指定 |
| `forearmL` | 左前腕・左手 | `pipe(byName("前腕"), psdGroup("手グループ"))` |
| `upperArmR` | 右上腕 | `byName()` で直接指定 |
| `forearmR` | 右前腕・右手 | `pipe(byName("前腕"), psdGroup("手グループ"))` |
| `legs` | 脚全体 | 脚グループを `psdGroup()` で指定 |
| `hairFront` | 前髪 | 前髪グループを `psdGroup()` で指定 |
| `hairSide` | サイドの髪 | サイド髪グループを `psdGroup()` で指定 |
| `hairBack` | 後ろ髪 | 後ろ髪グループを `psdGroup()` で指定 |

### 記述テンプレート

```ts
rigNodes(nodes, {
  // 頭部：表情パーツ（目・瞳・口）も head に含めること。
  // groupNodes で制御するパーツも rig に入れないと頭の動きに追従しない。
  head:      pipe(
               psdGroup("顔グループ"),
               psdGroup("耳グループ"),
               psdGroup("目Lグループ"),   // ← eyeL に使うグループ
               psdGroup("目Rグループ"),   // ← eyeR に使うグループ
               psdGroup("瞳Lグループ"),   // ← pupilL に使うグループ
               psdGroup("瞳Rグループ"),   // ← pupilR に使うグループ
               psdGroup("口グループ"),    // ← mouth に使うグループ（開き差分のみ）
             ),
  body:      psdGroup("胴体グループ", ["胸グループ", "脚グループ"]),
  chest:     psdGroup("胸グループ"),
  upperArmL: byName("左上腕レイヤー名"),
  forearmL:  pipe(byName("左前腕レイヤー名"), psdGroup("左手グループ")),
  upperArmR: byName("右上腕レイヤー名"),
  forearmR:  pipe(byName("右前腕レイヤー名"), psdGroup("右手グループ")),
  legs:      psdGroup("脚グループ"),
  hairFront: psdGroup("前髪グループ"),
  hairSide:  psdGroup("サイド髪グループ"),
  hairBack:  psdGroup("後ろ髪グループ"),
});
```

### よくある落とし穴

- グループ名が部分一致してしまう（例: 前髪グループが前髪サイドグループにもマッチ）→ negative で除外する
- `body` と `chest` など親子関係にあるグループが二重変形する → 親側の negative に子グループを追加する
- `body` の一部である袖・襟などが独立レイヤーの場合、`byName()` や `(n) => [...].includes(n.name)` で個別に拾う

---

## STEP 4: groupNodes の GroupMap を定義する

### 目的
表情パーツ（目・瞳・口）の `visible`, `alpha`, `scaleX`, `scaleY` などを `KokoroFace` 経由で制御するためのマッピング。

### FACE_NAME ごとの対応指針

| FACE_NAME | 対応するパーツ | 注意点 |
|-----------|--------------|--------|
| `eyeL` | 左目（白目・まぶた等） | `scaleY` で開閉制御される |
| `eyeR` | 右目 | 同上 |
| `pupilL` | 左瞳 | `x`, `y` で視線移動、`scaleY` で開閉に追従 |
| `pupilR` | 右瞳 | 同上 |
| `mouth` | 口 | **開いている状態のレイヤーを選ぶこと**（`scaleY=0` で閉じ、`scaleY=1` で全開になる） |

### 口レイヤーの選び方（重要）

`setOpenMouth(t)` は `mouth` グループの `scaleY` を `t` にセットする。
`scaleY=0` が「閉じた状態」、`scaleY=1` が「最大に開いた状態」になるため、
**口は開いている差分レイヤーを選ぶ必要がある**。
閉じた口のレイヤーを選ぶと `scaleY` で潰れるだけで開閉にならない。

```ts
groupNodes(nodes, {
  eyeL:   psdGroup("左目グループ"),
  eyeR:   psdGroup("右目グループ"),
  pupilL: psdGroup("左瞳グループ"),
  pupilR: psdGroup("右瞳グループ"),
  mouth:  psdGroup("開き口グループ"),  // ← 開いている状態の差分を選ぶ
});
```

---

## チェックリスト

- [ ] `SKIP` に描画対象レイヤーの祖先グループが含まれていないか
- [ ] 差分レイヤーが複数同時に表示されていないか（`SKIP` で余分な差分を隠す）
- [ ] `RigMap` にすべての `BONE_NAME` キーが存在するか
- [ ] `GroupMap` にすべての `FACE_NAME` キーが存在するか
- [ ] `psdGroup` の negative で除外すべき子グループが漏れていないか
- [ ] 同じレイヤーが複数ボーンにマッチしていないか（二重変形の原因）
- [ ] `mouth` に**開いている状態**のレイヤーを選んでいるか
- [ ] `byName` で指定した名前がPSD内に実在するか（`bun psd` の出力で確認）

---

## 参考: マッチャー関数のシグネチャ

```ts
type GroupMatcher = (n: SpriteNode) => boolean;

interface SpriteNode {
  name: string;       // レイヤー名
  path: string[];     // ルートからの全祖先名 + 自身の名前
  container: PIXI.Container;
  sprite: PIXI.MeshPlane;
}
```
