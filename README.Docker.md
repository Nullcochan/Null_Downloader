# Null Downloader - Docker Deployment Guide

セキュリティ強化版のNull Downloader Dockerデプロイメントガイド

## 📋 修正内容サマリー

### 🔴 修正された重大な問題
1. **コマンドインジェクション脆弱性** → `spawn()`による引数配列化で対策
2. **パストラバーサル脆弱性** → ファイル名サニタイズ機能追加
3. **環境変数未使用** → `.env`ファイル対応、Docker環境対応
4. **エラーハンドリング不足** → グローバルエラーハンドラー実装
5. **リソース管理問題** → 同時ダウンロード数制御、タイムアウト処理

### ✅ 追加された機能
- ヘルスチェックエンドポイント (`/health`)
- セキュリティヘッダー自動付与
- URL検証強化（ローカルネットワーク拒否）
- グレースフルシャットダウン
- 構造化ログ出力
- Docker対応（マルチステージビルド）

---

## 🚀 クイックスタート

### 前提条件
- Docker 20.10以降
- Docker Compose 1.29以降

### 1. 環境変数設定

```bash
# .env.exampleをコピー
cp .env.example .env

# 必要に応じて編集
nano .env
```

### 2. Dockerビルド & 起動

```bash
# Docker Composeで起動（推奨）
docker-compose up -d

# ログ確認
docker-compose logs -f

# 停止
docker-compose down
```

### 3. アクセス確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# ブラウザで開く
# http://localhost:3000
```

---

## 🐳 Docker Commands

### ビルド
```bash
# イメージをビルド
docker build -t null-downloader:latest .

# 特定のプラットフォーム向けにビルド
docker buildx build --platform linux/amd64,linux/arm64 -t null-downloader:latest .
```

### 実行
```bash
# 基本実行
docker run -p 3000:3000 null-downloader:latest

# 環境変数を指定
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e MAX_CONCURRENT_DOWNLOADS=5 \
  null-downloader:latest

# tmpディレクトリをマウント（永続化）
docker run -p 3000:3000 \
  -v $(pwd)/tmp:/app/tmp \
  null-downloader:latest
```

### デバッグ
```bash
# コンテナ内でシェルを起動
docker exec -it null-downloader sh

# ログをリアルタイム表示
docker logs -f null-downloader

# コンテナの状態確認
docker inspect null-downloader
```

---

## ⚙️ 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `PORT` | `3000` | サーバーポート |
| `NODE_ENV` | `development` | 環境（development/production） |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | 同時ダウンロード数上限 |
| `DOWNLOAD_TIMEOUT_MS` | `300000` | ダウンロードタイムアウト（ミリ秒） |
| `TMP_DIR` | `./tmp` | 一時ファイル保存ディレクトリ |
| `LOG_LEVEL` | `info` | ログレベル |

---

## 🔒 セキュリティ強化内容

### 1. コマンドインジェクション対策
```javascript
// 修正前（危険）
exec(`yt-dlp "${url}"`)

// 修正後（安全）
spawn('yt-dlp', [url])
```

### 2. 入力検証強化
- URL形式検証
- ローカルネットワークアドレス拒否
- ファイル名サニタイズ

### 3. セキュリティヘッダー
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### 4. 非rootユーザー実行
```dockerfile
USER nodejs  # UID 1001
```

### 5. リソース制限
- 同時ダウンロード数制御
- タイムアウト処理
- メモリ/CPU制限（docker-compose.yml）

---

## 📊 ヘルスチェック

### エンドポイント
```bash
GET /health
```

### レスポンス例
```json
{
  "status": "ok",
  "uptime": 3600.5,
  "timestamp": "2025-10-11T12:34:56.789Z",
  "activeDownloads": 2
}
```

### Docker Healthcheck
- Interval: 30秒
- Timeout: 10秒
- Retries: 3回

---

## 🏗️ アーキテクチャ

### マルチステージビルド
```
Stage 1 (builder)
├─ node:18-alpine
├─ npm ci --only=production
└─ 依存関係のみインストール

Stage 2 (production)
├─ node:18-alpine
├─ yt-dlp + ffmpeg インストール
├─ 非rootユーザー作成
└─ アプリケーションコピー
```

### ファイル構成
```
/app
├── server.js           # メインアプリケーション
├── public/             # 静的ファイル
│   ├── index.html
│   └── style.css
├── tmp/                # 一時ファイル
└── node_modules/       # 依存関係
```

---

## 🛠️ トラブルシューティング

### Q: yt-dlpが見つからない
```bash
# コンテナ内で確認
docker exec -it null-downloader sh
which yt-dlp
yt-dlp --version
```

### Q: FFmpegが見つからない
```bash
# コンテナ内で確認
docker exec -it null-downloader sh
which ffmpeg
ffmpeg -version
```

### Q: ダウンロードが失敗する
```bash
# ログを確認
docker logs null-downloader

# yt-dlpを最新版に更新
docker exec -it null-downloader sh
pip3 install --upgrade yt-dlp
```

### Q: ポート3000が使用中
```bash
# ポートを変更（docker-compose.yml）
ports:
  - "8080:3000"  # ホスト側を8080に変更
```

### Q: tmpディレクトリがいっぱい
```bash
# tmpディレクトリをクリーンアップ
docker exec null-downloader rm -rf /app/tmp/*

# または再起動（自動クリーンアップ）
docker-compose restart
```

---

## 📦 本番デプロイメント

### リバースプロキシ（Nginx）
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
    }
}
```

### SSL/TLS（Let's Encrypt）
```bash
# Certbotインストール
sudo apt install certbot python3-certbot-nginx

# SSL証明書取得
sudo certbot --nginx -d yourdomain.com
```

### システムサービス化
```bash
# docker-compose.ymlを/opt/null-downloaderに配置

# systemdサービスファイル作成
sudo nano /etc/systemd/system/null-downloader.service
```

```ini
[Unit]
Description=Null Downloader
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/null-downloader
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# サービス有効化
sudo systemctl enable null-downloader
sudo systemctl start null-downloader
```

---

## 🔄 更新手順

### アプリケーション更新
```bash
# 最新コードを取得
git pull

# Dockerイメージを再ビルド
docker-compose build

# コンテナを再起動
docker-compose up -d

# 古いイメージを削除
docker image prune -f
```

### yt-dlp更新
```bash
# コンテナ内で更新
docker exec null-downloader pip3 install --upgrade yt-dlp

# または再ビルド
docker-compose build --no-cache
docker-compose up -d
```

---

## 📈 モニタリング

### ログ監視
```bash
# リアルタイムログ
docker logs -f null-downloader

# 最新100行
docker logs --tail 100 null-downloader

# タイムスタンプ付き
docker logs -t null-downloader
```

### リソース使用状況
```bash
# CPU/メモリ使用率
docker stats null-downloader

# コンテナ詳細
docker inspect null-downloader
```

---

## ⚠️ 注意事項

### 法的事項
1. **著作権遵守**: 私的利用の範囲内でのみ使用
2. **利用規約**: 各プラットフォームの規約を確認
3. **個人利用**: インターネットに公開しないこと
4. **自己責任**: 全ての利用は自己責任で

### セキュリティ
- **公開禁止**: ローカルネットワークでのみ使用推奨
- **認証**: 公開する場合は必ず認証を実装すること
- **SSL/TLS**: HTTPS必須（本番環境）
- **ファイアウォール**: 不要なポートを閉じること

---

## 📚 参考リンク

- [Docker Documentation](https://docs.docker.com/)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 📄 ライセンス

個人学習目的のみ。商用利用・再配布禁止。
