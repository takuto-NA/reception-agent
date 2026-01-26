# Prisma / DB 操作メモ（詰まりポイント対策）

## 目的

- **初見で迷わない**: 「どのDBを見ているか」「どのコマンドを叩くべきか」を固定化する
- **事故を防ぐ**: `DATABASE_URL` の取り違えや、マイグレーション未適用での 500 を回避する
- **Windowsで詰まりやすい点**（Prisma Engine ロック）を事前に潰す

## まず確認すること（最重要）

### 1) どのDBを使っているか（`DATABASE_URL`）

このプロジェクトのDBは **Prismaの `DATABASE_URL`** で決まります。

- 推奨（このリポジトリ標準）: `file:./prisma/dev.db`
- 注意: `file:./dev.db` にすると **別ファイル**（リポジトリ直下の `dev.db`）になります

`.env.local` に以下が入っているか確認してください。

```text
DATABASE_URL="file:./prisma/dev.db"
```

### 2) dev serverを起動したまま Prisma を触っていないか

Windowsでは `node.exe` が Prisma Engine DLL を掴んでいて、`prisma generate` が `EPERM: operation not permitted, rename ...query_engine...` で失敗することがあります。

- **基本方針**: Prisma操作（migrate/generate）前に `npm run dev` を止める

## よく使うコマンド（PowerShell）

### DBを作る / 更新する（開発）

```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate dev
npx prisma generate
```

### マイグレーションを適用する（deploy）

```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate deploy
npx prisma generate
```

### 状態を見る

```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate status
```

## 典型的な詰まりと対処

### A) `/api/settings` が 500 になり「Loading…」「Unexpected end of JSON input」

代表例:

- `The column main.AppConfig.voiceSettings does not exist in the current database.`

原因:

- **マイグレーション未適用** か、**別のDBを見ている（`DATABASE_URL` 取り違え）**

対処:

1. `DATABASE_URL` を `file:./prisma/dev.db` に統一
2. dev serverを止める
3. マイグレーションを適用して再生成

```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate deploy
npx prisma generate
npm run dev
```

### B) `EPERM ... query_engine-windows.dll.node.tmpXXXX -> ...`（generateが失敗）

原因:

- `node.exe`（Next dev / テスト / エディタ拡張等）が Prisma Engine DLL を掴んでいる

対処（推奨順）:

1. **`npm run dev` を停止**（Ctrl+C）
2. 再度 `npx prisma generate`
3. それでもダメなら、DLLを掴んでいるプロセスを確認して終了

```powershell
tasklist /m query_engine-windows.dll.node
Stop-Process -Id <PID> -Force
```

## 開発フロー（Settings項目を増やすとき）

1. `prisma/schema.prisma` を更新
2. DBマイグレーション作成・適用
3. Prisma Client生成
4. `lib/appConfig.ts`（DTO/DEFAULT/parse/upsert）を更新
5. `app/api/settings/route.ts`（zod）を更新
6. `app/settings/*`（UI）を更新

コマンド例:

```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate dev --name <meaningful_name>
npx prisma generate
```

## 参考

- Prisma schema: `prisma/schema.prisma`
- Prisma config: `prisma.config.ts`（`DATABASE_URL` フォールバックあり）
- DBアクセス: `lib/prisma.ts` / `lib/appConfig.ts`

