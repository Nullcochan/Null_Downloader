# Security Fixes & Improvements

Null Downloaderのセキュリティ修正内容詳細

## 🔴 Critical Vulnerabilities Fixed

### 1. Command Injection (コマンドインジェクション)

**Issue**: URLやパラメータを直接シェルコマンドに埋め込み、任意コード実行が可能

#### 修正前（脆弱）
```javascript
// server.js:73
const ytDlpCommand = `yt-dlp --no-playlist -f "${formatSelector}" --extract-audio --audio-format ${expectedExt} --audio-quality 0 -o "${outputPath}" "${url}"`;
exec(ytDlpCommand, (error, stdout, stderr) => { ... });
```

**攻撃例**:
```bash
URL: https://example.com/video.mp4"; rm -rf /; echo "
→ 実行されるコマンド: yt-dlp ... "https://example.com/video.mp4"; rm -rf /; echo ""
```

#### 修正後（安全）
```javascript
// server.fixed.js:147-161
const args = ['--no-playlist'];
if (format_id) {
  args.push('-f', download_type === 'audio' ? format_id : `${format_id}+bestaudio`);
}
args.push('-o', outputPath, url);

// spawn()を使用して引数を配列で渡す
const process = spawn('yt-dlp', args);
```

**対策ポイント**:
- `exec()`の代わりに`spawn()`を使用
- 引数を文字列ではなく配列で渡す
- シェル経由の実行を回避

---

### 2. Path Traversal (パストラバーサル)

**Issue**: ファイル名に`../`等を含めることで、意図しないディレクトリへのアクセスが可能

#### 修正前（脆弱）
```javascript
// server.js:43
const outputPath = path.join(TMP_DIR, `${timestamp}.${expectedExt}`);
// expectedExtにユーザー入力が含まれる
```

**攻撃例**:
```bash
audio_format: "../../etc/passwd"
→ 生成されるパス: /app/tmp/../../../etc/passwd
```

#### 修正後（安全）
```javascript
// server.fixed.js:52-54
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const outputPath = path.join(TMP_DIR, sanitizeFilename(`${timestamp}.${expectedExt}`));
```

**対策ポイント**:
- ファイル名に使用可能な文字を制限
- パス区切り文字（`/`, `\`）を除去
- 英数字とハイフン、アンダースコア、ドットのみ許可

---

### 3. Server-Side Request Forgery (SSRF)

**Issue**: 内部ネットワークやローカルホストへのリクエストが可能

#### 修正前（脆弱）
```javascript
// server.js: URL検証なし
app.post('/download', async (req, res) => {
  const { url } = req.body;
  // URLの検証なしで直接yt-dlpに渡す
});
```

**攻撃例**:
```bash
URL: http://localhost:6379/  # Redis
URL: http://192.168.1.1/admin  # 内部ネットワーク
URL: file:///etc/passwd  # ローカルファイル
```

#### 修正後（安全）
```javascript
// server.fixed.js:46-61
function validateUrl(url) {
  try {
    const parsed = new URL(url);
    // HTTPSのみ許可
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    // ローカルネットワークアドレスを拒否
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

**対策ポイント**:
- HTTP/HTTPSのみ許可
- ローカルアドレス（localhost, 127.0.0.1）を拒否
- プライベートIPレンジ（192.168.x.x, 10.x.x.x）を拒否

---

## 🟡 Important Security Improvements

### 4. Denial of Service (DoS) Prevention

**Issue**: 無制限の同時ダウンロードによるリソース枯渇

#### 修正前（脆弱）
```javascript
// server.js: 同時ダウンロード数の制限なし
app.post('/download', async (req, res) => {
  // 制限なく実行される
});
```

#### 修正後（安全）
```javascript
// server.fixed.js:17-18,63-68
const MAX_CONCURRENT_DOWNLOADS = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3', 10);
let activeDownloads = 0;

function checkConcurrentLimit() {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    throw new Error('同時ダウンロード数の上限に達しています');
  }
}

app.post('/download', async (req, res) => {
  try {
    checkConcurrentLimit();
    activeDownloads++;
    // ダウンロード処理
  } finally {
    activeDownloads--;
  }
});
```

**対策ポイント**:
- 同時ダウンロード数を制限（デフォルト3）
- カウンターで管理
- 429エラーでリクエスト拒否

---

### 5. Timeout Protection

**Issue**: 長時間実行によるリソース占有

#### 修正後（追加）
```javascript
// server.fixed.js:71-95
function executeYtDlp(args, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args);

    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error('ダウンロードがタイムアウトしました'));
    }, timeoutMs);

    process.on('close', (code) => {
      clearTimeout(timeout);
      // 処理
    });
  });
}
```

**対策ポイント**:
- デフォルト300秒（5分）タイムアウト
- 環境変数で調整可能
- タイムアウト時はプロセスをKILL

---

### 6. Security Headers

**Issue**: XSS、クリックジャッキング等の脆弱性

#### 修正後（追加）
```javascript
// server.fixed.js:21-26
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

**対策ポイント**:
- `X-Content-Type-Options`: MIME sniffing防止
- `X-Frame-Options`: クリックジャッキング防止
- `X-XSS-Protection`: XSS防止（レガシー対応）

---

### 7. Input Validation

**Issue**: 型チェックなしのユーザー入力

#### 修正後（追加）
```javascript
// server.fixed.js:101-110
if (!url || typeof url !== 'string') {
  return res.status(400).json({ error: 'URLが指定されていません' });
}

if (!validateUrl(url)) {
  return res.status(400).json({ error: '無効なURLです' });
}
```

**対策ポイント**:
- 型チェック（string, number）
- URL形式検証
- 400エラーで拒否

---

### 8. Error Information Disclosure

**Issue**: 本番環境でスタックトレースやエラー詳細が漏洩

#### 修正前（脆弱）
```javascript
// server.js:195
res.status(500).json({
  error: 'ダウンロードに失敗しました',
  details: error.message  // 常に詳細を返す
});
```

#### 修正後（安全）
```javascript
// server.fixed.js:204-207
res.status(500).json({
  error: 'ダウンロードに失敗しました',
  details: NODE_ENV === 'development' ? error.message : undefined
});
```

**対策ポイント**:
- 本番環境ではエラー詳細を隠蔽
- 開発環境のみ詳細を表示
- ログには完全なエラーを記録

---

## 🔒 Docker Security

### 9. Non-root User Execution

**Issue**: コンテナがroot権限で実行される

#### Dockerfile（修正後）
```dockerfile
# Dockerfile:16-17
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Dockerfile:30
USER nodejs
```

**対策ポイント**:
- 専用ユーザー（nodejs, UID 1001）を作成
- root権限を放棄
- ファイルの所有権を適切に設定

---

### 10. Resource Limits

**Issue**: コンテナによる無制限のリソース消費

#### docker-compose.yml（追加）
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

**対策ポイント**:
- CPU使用率を1コアに制限
- メモリを1GBに制限
- 最小予約リソースを設定

---

## 📋 Security Checklist

### 実装済み
- [x] コマンドインジェクション対策
- [x] パストラバーサル対策
- [x] SSRF対策
- [x] DoS対策（レート制限）
- [x] タイムアウト保護
- [x] セキュリティヘッダー
- [x] 入力検証強化
- [x] エラー情報漏洩防止
- [x] 非root実行
- [x] リソース制限

### 推奨追加対策（今後）
- [ ] JWT認証（公開する場合必須）
- [ ] CSRF対策トークン
- [ ] レート制限ミドルウェア（express-rate-limit）
- [ ] HTTPS強制リダイレクト
- [ ] Content Security Policy (CSP)
- [ ] APIキー認証
- [ ] ログ監視・アラート
- [ ] 定期的な依存関係更新

---

## 🛡️ Best Practices

### コード
1. 外部コマンド実行は`spawn()`を使用
2. ユーザー入力は必ず検証・サニタイズ
3. エラーハンドリングを徹底
4. 環境変数で設定を管理
5. ログレベルを適切に設定

### デプロイ
1. HTTPSを必須化
2. リバースプロキシ（Nginx）を使用
3. ファイアウォールで不要なポートを閉じる
4. 定期的なセキュリティアップデート
5. ログ監視とアラート設定

### 運用
1. ローカルネットワークでのみ使用
2. 公開する場合は認証を実装
3. アクセスログを保存
4. 定期的なバックアップ
5. インシデント対応計画を準備

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
