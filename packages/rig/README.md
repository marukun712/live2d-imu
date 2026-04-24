# @kokoro/rig

PSD レイヤーをメッシュ変形でアニメーションさせる、人型キャラクター向けのメッシュ変形ライブラリです。
複雑な GUI は不要で、コードと頂点ウェイトの定義だけでキャラクターを動かせます。

## コアコンセプト

### レイヤーのロードと描画

`walkPSD` は PSD を再帰的に走査して末端レイヤーをフラットな配列として返します。
各スプライトは `SpriteNode` として管理されます。

```ts
const layers = await walkPSD("/models/character.psd");
const nodes = drawCharacter(layers);
```

### GroupMatcher - レイヤーの絞り込み

`GroupMatcher` はノードを受け取って `boolean` を返す関数型です。
名前やパスでレイヤーを絞り込む際に使います。

```ts
psdGroup("前髪")           // パスに "前髪" を含む全レイヤー
byName("目_デフォルト")     // 名前が完全一致するレイヤー
byPath(["顔", "眉"])        // パスの末尾が ["顔", "眉"] のレイヤー
pipe(matcherA, matcherB)   // いずれかにマッチするレイヤー
```

`walkPSD` の `show` / `hide` オプションに渡すと、ロード時点でレイヤーの表示状態を上書きできます。
これにより、髪型や衣装などのバリエーション切り替えをレイヤー構造で管理できます。

### KokoroGroup - まとめて操作

`groupNodes` で絞り込んだノード群を `KokoroGroup` にまとめると、`x`, `y`, `visible`, `alpha` などのプロパティを一括で操作できます。

### KokoroRig - メッシュ変形

`KokoroRig` はキャラクターの骨格的な変形を担います。
毎フレーム、各頂点を UV 座標 (u, v) に正規化してから `PoseTransform` 関数を呼び出し、平行移動 (tx, ty)を計算して頂点バッファに書き戻します。
変形の強さは頂点の位置によって連続的に変化するため、ボーンを使わずにソフトボディ的な動きを実現できます。

```ts
const rig = new KokoroRig(app, nodes, {
  poseTemplate: POSE_TEMPLATE,
  bounds: calcBounds(nodes),
});

// 毎フレーム setPose を呼びます
app.ticker.add(() => {
  rig.setPose([
    rig.lerpBlend("left", "right", mouseX), // 2 つのポーズを補間
    rig.lerpBlend("up", "down", mouseY),
  ]);
});
```

#### Template と PoseTransform

`Template` はポーズ名をキーとする `PoseTransform` の辞書です。
`PoseTransform` は `(u, v, t) => { tx, ty, w }` のシグネチャを持ち、頂点ごとの変形量を返す関数です。
`w` はウェイトで、複数のポーズが合成される際のブレンド比率になります。

```ts
const MY_TEMPLATE: Template = {
  left: (u, v) => ({
    tx: -100,
    ty: 0,
    w: curve.body(1 - v), // 上半身ほど大きく動かす
  }),
};
```

`curve` にはイージング関数が収録されており、UV 値からウェイトへの変換に使います。

#### 親リグの継承

`parent` オプションで親リグを指定すると、親の `activeTransform` が子の変形に加算されます。
体幹リグを親にして髪や腕に子リグを作ると、体幹の動きを受け継ぎながら部位ごとの独立した揺れを加えられます。

### KokoroFace - 表情制御

`KokoroFace` はレイヤーの表示 / 非表示の組み合わせで表情を管理するクラスです。
`apply` にレイヤー名と真偽値のマップを渡すと、対応するグループの `visible` が一括で切り替わります。

```ts
const face = new KokoroFace(nodes, ["*閉じ", "*あ半"]);

face.apply({ "*閉じ": true, "*あ半": false }); // 目を閉じる
```
