## エージェント追加（開発者向け拡張ポイント）

### 目的

- **初見で迷わない**: Agent登録場所と参照方法を明確にする

### 追加手順（最短）

1) `mastra/agents/` に Agent を追加

- 例: `mastra/agents/my-agent.ts`
- `new Agent({ id, name, instructions, model, tools, memory })` を実装

2) `mastra/agents/registry.ts` に登録

- `agentRegistry` オブジェクトに登録キーを追加します
- **このキー**が `mastra.getAgent("<key>")` の引数になります（登録キー）

3) `mastra/index.ts` は `agentRegistry` を参照するだけなので、通常は変更不要です

4) 呼び出し側（API）で参照

- 例: `mastra.getAgent("<key>")`

### 注意（初見が混乱しやすい点）

- `Agent` には `id: "chat-agent"` のような **内部ID** があり、`mastra.getAgent("chatAgent")` のような **登録キー** は別物です。\n  初見の混乱を避けるため、プロジェクト内では「登録キー」を優先して説明します。

