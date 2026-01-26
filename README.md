## Reception Agent

Mastra + Groq で動く **ツール実行可能なAIエージェント**のサンプルWebアプリです。

- **Chat**: ストリーミング応答（`/api/chat`）
- **Settings**: 人格（system prompt）/モデル/ツール有効化をUIから編集（SQLite + Prisma）
- **Voice input**: ブラウザの Web Speech API で音声入力（対応ブラウザのみ）

## Getting Started

### Prerequisites

- **Node.js**: 22.x（Mastraは `>=22.13.0` を要求します。環境によっては警告が出ます）
- **Groq API Key**: `GROQ_API_KEY`

### Setup

1. Install deps

```bash
npm install
```

2. Configure env

- Copy [`env.example`](env.example) → `.env.local`（もしくは `.env`）
- Prisma 用に `DATABASE_URL` も設定してください（例: `file:./prisma/dev.db`）。
  - 未設定の場合は `lib/prisma.ts` のフォールバックで `file:./prisma/dev.db` が使われます。

例:

```bash
GROQ_API_KEY=...
GROQ_MODEL=groq/llama-3.3-70b-versatile
DATABASE_URL="file:./prisma/dev.db"
```

3. Create/update DB

```bash
npx prisma migrate dev
```

4. Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## How it works

### Chat

- UI: [`app/page.tsx`](app/page.tsx)
- API: [`app/api/chat/route.ts`](app/api/chat/route.ts)
- Agent: [`mastra/agents/chat-agent.ts`](mastra/agents/chat-agent.ts)

`/api/chat` は Settings から保存した **system prompt / model / enabled tools** を読み込み、Mastra Agent の実行オプションに反映します。

> 優先順位（初見向け）
>
> 1. DB（Settings画面で保存した値）
> 2. 環境変数（`GROQ_MODEL` など）
> 3. コード内のデフォルト（フォールバック）

### Settings

- UI: [`app/settings/page.tsx`](app/settings/page.tsx)
- API: [`app/api/settings/route.ts`](app/api/settings/route.ts)
- DB access: [`lib/appConfig.ts`](lib/appConfig.ts)
- Prisma schema: [`prisma/schema.prisma`](prisma/schema.prisma)

### Tool registry（開発者向け拡張ポイント）

ツールは `mastra/tools` に追加し、[`mastra/tools/registry.ts`](mastra/tools/registry.ts) の `tools` に登録します。

Settings 画面は `/api/tools`（[`app/api/tools/route.ts`](app/api/tools/route.ts)）から一覧を取得し、有効化されたツールだけがチャット実行時に `activeTools` として渡されます。

### Voice input

[`app/components/VoiceInput.tsx`](app/components/VoiceInput.tsx) をチャット入力に統合しています。
ブラウザによっては Web Speech API が使えません（その場合はボタンが表示されません）。

## Commands

```bash
npm test
npm run build
npm run format
```

> Note: `npm run build` は `next build --webpack` を使っています（環境によって Turbopack build がハングするケースがあったため）。

## Developer docs

- [ツール追加](docs/extension-tools.md)
- [エージェント追加](docs/extension-agents.md)
- [Settings項目追加](docs/extension-settings.md)
- [Prisma/DB 操作メモ](docs/prisma-operations.md)

## Notes

- GroqはOpenAI互換ですが、未サポート項目があります（例: `messages[].name` 等）。Mastra側のモデルルータ（`groq/...`）を使う運用を推奨します。
