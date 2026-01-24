## Settings項目追加（開発者向け拡張ポイント）

### 目的

- **初見で迷わない**: UI/API/DBの変更箇所を最小にして手順を固定化する

### 追加手順（最短）

1) DB（Prisma）を拡張

- `prisma/schema.prisma` の `AppConfig` にカラムを追加
- `npx prisma migrate dev` を実行

2) サーバ（DTO）を拡張

- `lib/appConfig.ts` の `AppConfigDTO` / `DEFAULTS` / `getAppConfig()` / `upsertAppConfig()` を更新

3) APIのバリデーションを更新

- `app/api/settings/route.ts` の `UpdateSchema` に項目を追加\n  （制約値は定数化し、意図が分かる名前にする）

4) UIを更新

- `app/settings/page.tsx` でフォーム項目を追加\n  （API呼び出しは `app/settings/settingsApi.ts` 側に閉じ込める）

