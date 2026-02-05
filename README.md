## Reception Agent

Mastra + (LMSTUDIO / Groq) で動く **ツール実行可能なAIエージェント**のサンプルWebアプリです。

- **Chat**: ストリーミング応答（`/api/chat`）
- **Settings**: system prompt / model / ツール有効化をUIから編集（SQLite + Prisma）
- **Voice input**: ブラウザの Web Speech API で音声入力（対応ブラウザのみ）

詳細な設計・運用・拡張手順は `docs/` に集約しています（READMEは入口に徹します）。

## Getting Started

### Prerequisites

- **Node.js**: **>= 22.13.0**（Mastra要件）
  - 目安: `.nvmrc` / `.node-version` に合わせてください
- **LMSTUDIO または Groq**（どちらか）
  - **LMSTUDIO**: `http://127.0.0.1:1234` で OpenAI互換APIを起動
  - **Groq**: API Key を用意（以下の Option A/B）
    - **Option A**: `.env.local` に `GROQ_API_KEY`
    - **Option B（推奨）**: `.env.local` に `APP_CONFIG_ENCRYPTION_KEY` を入れて、起動後に Settings から API key を保存（DBに暗号化保存）

### Setup

1. Install deps

```bash
npm install
```

2. Configure env

- Copy [`env.example`](env.example) → `.env.local`（推奨）
- `DATABASE_URL="file:./prisma/dev.db"` を設定（DBまわりの詳細は [`docs/prisma-operations.md`](docs/prisma-operations.md)）
- Option B（SettingsでAPI keyを入れる）を使うなら `APP_CONFIG_ENCRYPTION_KEY` を設定
  - 生成: `npm run key:gen`

例（LMSTUDIO）:

```bash
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
LMSTUDIO_API_KEY=lm-studio
MODEL_ID=lmstudio/lfm2-8b-a1b
DATABASE_URL="file:./prisma/dev.db"
```

例（Groq）:

```bash
GROQ_API_KEY=...
MODEL_ID=groq/llama-3.3-70b-versatile
DATABASE_URL="file:./prisma/dev.db"
```

3. Create/update DB

```bash
npm run db:setup
```

> Windowsの注意: `EPERM ... query_engine-windows.dll.node.tmp -> ...` が出る場合は\n+> `node.exe` がPrismaのDLLを掴んでいます。`npm run dev` を止めてから再実行し、ダメなら\n+> `tasklist /m query_engine-windows.dll.node` でPIDを特定して終了してください。\n+> 詳細: [`docs/troubleshooting.md`](docs/troubleshooting.md) / [`docs/prisma-operations.md`](docs/prisma-operations.md)

4. Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

> Note: `npm run dev` は安定性優先で `next dev --webpack` を使います。
> `npm run dev:turbopack` で Turbopack も試せますが、環境によって Tailwind が反映されずレイアウトが崩れる場合があります。

### “起動できた”の最低ライン（チェックリスト）

- `http://localhost:3000` が表示できる
- `http://localhost:3000/settings` が表示できる（500にならない）
- Chatが動く（LMSTUDIO または Groq で応答が返る）

### 初回起動チェックリスト（詰まり回避）

- `.env.local` が存在する（`env.example` をコピー）
- `DATABASE_URL="file:./prisma/dev.db"` に設定済み
- `npm run db:setup` 実行済み
- LMSTUDIO利用時: `LMSTUDIO_BASE_URL=http://127.0.0.1:1234` と `MODEL_ID=lmstudio/<model>`
- Groq利用時: `GROQ_API_KEY` を設定、もしくは Settings で保存

## How it works

### Chat

- UI: [`app/page.tsx`](app/page.tsx)
- API: [`app/api/chat/route.ts`](app/api/chat/route.ts)
- Agent: [`mastra/agents/chat-agent.ts`](mastra/agents/chat-agent.ts)

`/api/chat` は Settings から保存した **system prompt / model / enabled tools** を読み込み、Mastra Agent の実行オプションに反映します。

> 優先順位（初見向け）
>
> 1. DB（Settings画面で保存した値）
> 2. 環境変数（`MODEL_ID` など）
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
npm run typecheck
npm run build
npm run format
npm run db:setup
```

> Note: `npm run build` は `next build --webpack` を使っています（環境によって Turbopack build がハングするケースがあったため）。

## Developer docs

- [アーキテクチャ概要](docs/architecture.md)
- [トラブルシューティング](docs/troubleshooting.md)
- [セキュリティ（秘密情報/暗号化）](docs/security.md)
- [テスト](docs/testing.md)
- [ツール追加](docs/extension-tools.md)
- [エージェント追加](docs/extension-agents.md)
- [Settings項目追加](docs/extension-settings.md)
- [Prisma/DB 操作メモ](docs/prisma-operations.md)

## Notes

- GroqはOpenAI互換ですが、未サポート項目があります（例: `messages[].name` 等）。Mastra側のモデルルータ（`groq/...`）を使う運用を推奨します。

## Troubleshooting

困ったらまず [`docs/troubleshooting.md`](docs/troubleshooting.md) を参照してください。
