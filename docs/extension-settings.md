## Settings項目追加（開発者向け拡張ポイント）

### 目的

- **初見で迷わない**: UI/API/DBの変更箇所を最小にして手順を固定化する

### 追加手順（最短）

1) DB（Prisma）を拡張

- `prisma/schema.prisma` の `AppConfig` にカラムを追加
- `npx prisma migrate dev` を実行\n  （詰まりやすいポイントは [Prisma/DB 操作メモ](prisma-operations.md) を参照）

2) サーバ（DTO）を拡張

- `lib/appConfig.ts` の `AppConfigDTO` / `DEFAULTS` / `getAppConfig()` / `upsertAppConfig()` を更新

3) APIのバリデーションを更新

- `app/api/settings/route.ts` の `UpdateSchema` に項目を追加\n  （制約値は定数化し、意図が分かる名前にする）

4) UIを更新

- Settingsはタブ（ルート分割）で拡張します。\n  目的のカテゴリに合わせてページを選んでフォーム項目を追加してください。\n\n  - General: `app/settings/page.tsx`\n  - Tools: `app/settings/tools/page.tsx`\n  - Voice: `app/settings/voice/page.tsx`\n\n+- タブ自体を増やす場合は `app/settings/SettingsTabs.tsx` にリンクを追加します。\n\n+- API呼び出しは `app/settings/settingsApi.ts` 側に閉じ込め、ページ側はUIとstateのみに集中させます。

