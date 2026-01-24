## エージェント追加（開発者向け拡張ポイント）

### 目的

- **初見で迷わない**: Agent登録場所と参照方法を明確にする

### 追加手順（最短）

1) `mastra/agents/` に Agent を追加

- 例: `mastra/agents/my-agent.ts`
- `new Agent({ id, name, instructions, model, tools, memory })` を実装

2) `mastra/index.ts` で Mastra に登録

- `new Mastra({ agents: { ... } })` の `agents` に追加

3) 呼び出し側（API）で参照

- 例: `mastra.getAgent("<key>")`

### 注意（初見が混乱しやすい点）

- `Agent` には `id: "chat-agent"` のような **内部ID** があり、\n  `mastra.getAgent("chatAgent")` のような **登録キー** は別物です。\n  初見の混乱を避けるため、プロジェクト内では「登録キー」を優先して説明します。

