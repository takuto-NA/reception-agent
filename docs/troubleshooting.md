# トラブルシューティング

## 目的

- **まずここ**: 詰まったら最初に見るページを 1 つに固定する
- **再現性**: 「原因→対処」がコピペで進む状態にする

## 起動まわり

### A) Port 3000 is in use / `.next/dev/lock` が取れない

症状:

- `Port 3000 is in use ...`
- `Unable to acquire lock at ... .next\\dev\\lock`

原因:

- `next dev` が別プロセスで起動したまま
- Windowsで停止が不完全で lock が残っている

対処:

1. 既存の `node.exe`（next dev）を停止
2. lock を削除（残っていれば）

```powershell
Stop-Process -Id <PID> -Force
Remove-Item -Force .next\\dev\\lock
```

> 注意: Prisma 操作（generate 等）前に dev server を止めるのも推奨です（WindowsのDLLロック対策）。

## プロバイダ（LMSTUDIO / Groq）

### B) `LMSTUDIO configuration is missing`

症状:

```json
{"error":"LMSTUDIO configuration is missing","detail":"Set LMSTUDIO_BASE_URL in .env.local ..."}
```

原因:

- `.env.local` に `LMSTUDIO_BASE_URL` が無い

対処:

- `env.example` を `.env.local` にコピーして、以下を設定

```text
LMSTUDIO_BASE_URL=http://127.0.0.1:1234
MODEL_ID=lmstudio/<model-name>
```

### C) Groq API key not configured

対処:

- `.env.local` に `GROQ_API_KEY` を設定（Option A）\n  もしくは `APP_CONFIG_ENCRYPTION_KEY` を設定して Settings から保存（Option B）

詳細: [`docs/security.md`](security.md)

## 依存関係

### D) `Module not found: Can't resolve ...`

原因:

- `node_modules` が入っていない、または lockfile と不整合

対処:

```bash
npm install
```

CIや再現性を重視する場合:

```bash
npm ci
```

## DB / Prisma

### E) Settingsが500 / `Unexpected end of JSON input`

原因:

- DB未初期化、または `DATABASE_URL` が別DBを指している

対処（推奨）:

```bash
npm run db:setup
```

詳細: [`docs/prisma-operations.md`](prisma-operations.md)

### F) Windowsで `prisma generate` が `EPERM ... query_engine-windows.dll.node.tmp -> ...`

原因:

- `node.exe`（Next dev / テスト / エディタ拡張等）が Prisma Engine DLL を掴んでいる

対処（推奨順）:

1. **`npm run dev` を停止**
2. もう一度 `npm run db:setup` または `npm run db:generate`
3. それでもダメなら、DLLを掴んでいるプロセスを特定して終了

```powershell
tasklist /m query_engine-windows.dll.node
Stop-Process -Id <PID> -Force
```

詳細: [`docs/prisma-operations.md`](prisma-operations.md)

