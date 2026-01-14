# Migration Guide - 修正版への移行手順

旧版から修正版（Docker対応・セキュリティ強化版）への移行手順

## 📋 移行前の確認

### 現在のバージョン確認
```bash
cd E:\Nullco\Null_Downloader
node --version  # v18以降を推奨
npm --version
```

### バックアップ
```bash
# 現在の状態をバックアップ
cp server.js server.js.backup
cp package.json package.json.backup
```

---

## 🔄 ステップ1: ファイルの置き換え

### 1.1 サーバーファイルの更新
```bash
# 修正版サーバーファイルを有効化
cp server.fixed.js server.js

# または既存ファイルを削除して置き換え
rm server.js
mv server.fixed.js server.js
```

### 1.2 package.jsonの更新
```bash
# 新しいpackage.jsonに置き換え
cp package.updated.json package.json

# 依存関係を再インストール
npm install
```

### 1.3 環境変数ファイルの作成
```bash
# .env.exampleをコピーして設定
cp .env.example .env

# エディタで必要に応じて編集
nano .env  # またはVSCode等で編集
```

---

## 🧪 ステップ2: ローカルテスト

### 2.1 サーバー起動確認
```bash
# 開発モードで起動
npm run dev

# 別ターミナルでヘルスチェック
curl http://localhost:3000/health
```

**期待される出力**:
```json
{
  "status": "ok",
  "uptime": 1.234,
  "timestamp": "2025-10-11T12:34:56.789Z",
  "activeDownloads": 0
}
```

### 2.2 ダウンロード機能テスト
```bash
# ブラウザで開く
start http://localhost:3000

# または、curlでテスト（URLを実際のものに置き換え）
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### 2.3 エラーハンドリング確認
```bash
# 無効なURLでテスト（エラーが適切に処理されるか確認）
curl -X POST http://localhost:3000/download \
  -H "Content-Type: application/json" \
  -d '{"url":"invalid-url"}'

# 期待される出力: 400 Bad Request
```

---

## 🐳 ステップ3: Docker化

### 3.1 Docker環境確認
```bash
# Dockerバージョン確認
docker --version  # 20.10以降
docker-compose --version  # 1.29以降

# Dockerが起動しているか確認
docker ps
```

### 3.2 Dockerイメージビルド
```bash
# イメージをビルド
docker build -t null-downloader:latest .

# ビルド確認
docker images | grep null-downloader
```

**期待される出力**:
```
null-downloader  latest  abc123def456  2 minutes ago  XXX MB
```

### 3.3 Docker実行テスト
```bash
# コンテナを起動
docker run -d \
  --name null-downloader-test \
  -p 3000:3000 \
  --env-file .env \
  null-downloader:latest

# ログ確認
docker logs -f null-downloader-test

# ヘルスチェック
curl http://localhost:3000/health

# 停止・削除
docker stop null-downloader-test
docker rm null-downloader-test
```

### 3.4 Docker Compose起動
```bash
# Docker Composeで起動
docker-compose up -d

# 起動確認
docker-compose ps

# ログ確認
docker-compose logs -f

# ブラウザテスト
start http://localhost:3000
```

---

## ✅ ステップ4: 動作確認チェックリスト

### 基本機能
- [ ] サーバーが正常に起動する
- [ ] `/health`エンドポイントが200を返す
- [ ] トップページが表示される
- [ ] URL解析が動作する
- [ ] 動画ダウンロードが動作する
- [ ] 音声ダウンロードが動作する

### セキュリティ
- [ ] 無効なURL（localhost等）が拒否される
- [ ] 同時ダウンロード数制限が機能する
- [ ] タイムアウトが適切に動作する
- [ ] エラー時に詳細情報が漏洩しない（本番環境）

### Docker
- [ ] Dockerイメージがビルドできる
- [ ] コンテナが正常に起動する
- [ ] ヘルスチェックがPASSする
- [ ] ダウンロード機能が動作する
- [ ] コンテナ再起動後も動作する

---

## 🔧 トラブルシューティング

### Issue: サーバーが起動しない

**原因1**: 環境変数が設定されていない
```bash
# 解決策: .envファイルを確認
cat .env

# 必要に応じて再作成
cp .env.example .env
```

**原因2**: ポート3000が使用中
```bash
# 解決策: 使用中のプロセスを確認
netstat -ano | findstr :3000

# ポートを変更（.env）
PORT=8080
```

**原因3**: tmpディレクトリの権限エラー
```bash
# 解決策: ディレクトリを再作成
rm -rf tmp
mkdir tmp
```

---

### Issue: yt-dlpが見つからない（Docker）

**原因**: Dockerイメージのビルドが不完全

```bash
# 解決策: キャッシュなしで再ビルド
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# コンテナ内で確認
docker exec -it null-downloader sh
which yt-dlp
yt-dlp --version
```

---

### Issue: FFmpegが見つからない（Docker）

**原因**: Dockerイメージにffmpegがインストールされていない

```bash
# 解決策: Dockerfileを確認
cat Dockerfile | grep ffmpeg

# 再ビルド
docker-compose build --no-cache
docker-compose up -d
```

---

### Issue: ダウンロードが途中で止まる

**原因**: タイムアウト設定が短すぎる

```bash
# 解決策: タイムアウトを延長（.env）
DOWNLOAD_TIMEOUT_MS=600000  # 10分
```

---

### Issue: 同時ダウンロード数エラー

**原因**: MAX_CONCURRENT_DOWNLOADSの制限

```bash
# 解決策: 制限を緩和（.env）
MAX_CONCURRENT_DOWNLOADS=5

# 再起動
docker-compose restart
```

---

## 📊 移行後の確認

### パフォーマンステスト
```bash
# 複数ダウンロードを同時実行
for i in {1..5}; do
  curl -X POST http://localhost:3000/download \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com/video.mp4"}' &
done

# activeDownloadsが制限内か確認
curl http://localhost:3000/health
```

### セキュリティテスト
```bash
# SSRF攻撃テスト（拒否されるべき）
curl -X POST http://localhost:3000/download \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:6379/"}'

# 期待: 400 Bad Request

# コマンドインジェクションテスト（拒否されるべき）
curl -X POST http://localhost:3000/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/\"; rm -rf /; echo \""}'

# 期待: 400 Bad Request
```

### ログ監視
```bash
# リアルタイムログ監視
docker-compose logs -f

# エラーのみフィルタ
docker-compose logs | grep -i error

# 警告のみフィルタ
docker-compose logs | grep -i warning
```

---

## 🚀 本番デプロイ

### 環境変数の設定
```bash
# 本番用.envを作成
cp .env .env.production

# 編集
nano .env.production
```

**推奨設定**:
```env
NODE_ENV=production
PORT=3000
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT_MS=300000
LOG_LEVEL=warn
```

### Docker Composeで本番起動
```bash
# 本番用docker-compose.prod.yml作成
cp docker-compose.yml docker-compose.prod.yml

# 必要に応じて編集（リソース制限等）

# 起動
docker-compose -f docker-compose.prod.yml up -d
```

### リバースプロキシ設定（Nginx）
```bash
# Nginx設定ファイル作成
sudo nano /etc/nginx/sites-available/null-downloader
```

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
        client_max_body_size 10M;
    }
}
```

```bash
# 有効化
sudo ln -s /etc/nginx/sites-available/null-downloader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📝 ロールバック手順

問題が発生した場合の元に戻す手順：

### ローカル環境
```bash
# バックアップから復元
cp server.js.backup server.js
cp package.json.backup package.json

# 依存関係を再インストール
npm install

# 起動
npm start
```

### Docker環境
```bash
# コンテナを停止・削除
docker-compose down

# 旧イメージを使用（事前にタグ付けしている場合）
docker run -d -p 3000:3000 null-downloader:v1.0.0
```

---

## 🎯 次のステップ

移行完了後、以下を実施することを推奨：

1. **認証の実装**（公開する場合必須）
2. **HTTPS化**（SSL/TLS証明書の取得）
3. **ログ監視**（ELK Stack, Grafana等）
4. **バックアップ自動化**
5. **アラート設定**（ダウンタイム検知）
6. **定期的なyt-dlp更新**
7. **セキュリティ監査**

---

## 📚 参考ドキュメント

- [README.Docker.md](./README.Docker.md) - Docker詳細ガイド
- [SECURITY_FIXES.md](./SECURITY_FIXES.md) - セキュリティ修正詳細
- [package.json](./package.json) - 依存関係情報

---

## 💬 サポート

問題が発生した場合：

1. ログを確認: `docker-compose logs`
2. ヘルスチェック: `curl http://localhost:3000/health`
3. コンテナ状態: `docker ps -a`
4. イメージ確認: `docker images`

それでも解決しない場合は、ログとエラーメッセージを添えて相談してください。
