# Null Downloader

個人用動画ダウンローダー - YouTube等の動画サイトから動画・音声をダウンロードするWebアプリケーション

## 必要な環境

- **Node.js** (v18以降推奨)
- **yt-dlp** (動画ダウンロード)
- **FFmpeg** (動画・音声の処理・マージ) ⚠️ **必須**

## FFmpegのインストール（重要）

このアプリケーションは**FFmpegが必須**です。yt-dlpが映像と音声を別々にダウンロードした際に、FFmpegを使って自動的にマージします。

### Windowsの場合

#### 方法1: Chocolateyを使う（推奨）

```bash
# Chocolateyがインストールされている場合
choco install ffmpeg

# インストール確認
ffmpeg -version
```

#### 方法2: 手動インストール

1. [FFmpeg公式サイト](https://ffmpeg.org/download.html#build-windows)から最新版をダウンロード
2. ZIPファイルを解凍（例: `C:\ffmpeg`）
3. 環境変数のPATHに追加：
   ```
   C:\ffmpeg\bin
   ```
4. コマンドプロンプトを再起動して確認：
   ```bash
   ffmpeg -version
   ```

### Macの場合

```bash
# Homebrewを使う
brew install ffmpeg

# インストール確認
ffmpeg -version
```

### Linuxの場合

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# インストール確認
ffmpeg -version
```

## インストール手順

1. リポジトリをクローン

```bash
git clone <repository-url>
cd Null_Downloader
```

2. 依存パッケージをインストール

```bash
npm install
```

3. yt-dlpのインストール確認

```bash
yt-dlp --version
```

インストールされていない場合：

```bash
# Windows (Chocolatey)
choco install yt-dlp

# Mac (Homebrew)
brew install yt-dlp

# Linux
sudo apt install yt-dlp
```

## 起動方法

```bash
npm start
# または
node server.js
```

サーバーが起動したら、ブラウザで以下にアクセス：
```
http://localhost:3000
```

## 使い方

1. URL入力欄に動画URLを貼り付け
2. 「解析」ボタンをクリック
3. 品質を選択（動画: 144p～1440p、音声: MP3/WAV）
4. 「ダウンロード」ボタンをクリック
5. ファイルが自動的にダウンロードされます

## 対応サービス

- YouTube
- Facebook
- SoundCloud
- Vimeo
- TikTok
- IMDb
- X (Twitter)
- Twitch

※ yt-dlpが対応している全てのサービスで利用可能

## トラブルシューティング

### エラー: ダウンロードファイルが見つかりません

**原因**: FFmpegがインストールされていない、またはPATHに追加されていない

**解決策**:
1. FFmpegをインストール（上記参照）
2. 環境変数PATHにFFmpegを追加
3. コマンドプロンプト/ターミナルを再起動
4. `ffmpeg -version`で確認

### エラー: yt-dlp command not found

**原因**: yt-dlpがインストールされていない

**解決策**:
```bash
# Windows
choco install yt-dlp

# Mac
brew install yt-dlp

# Linux
sudo apt install yt-dlp
```

### ダウンロードが遅い

**原因**: サーバーの速度制限、または大きなファイルサイズ

**解決策**:
- より低い解像度を選択
- インターネット接続を確認
- 時間帯を変える

## ファイル構成

```
Null_Downloader/
├── server.js              # メインサーバーファイル
├── package.json           # Node.jsプロジェクト設定
├── public/                # フロントエンドファイル
│   ├── index.html
│   └── style.css
├── tmp/                   # 一時ファイル保存用
└── README.md              # このファイル
```

## 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript
- **バックエンド**: Node.js, Express
- **動画処理**: yt-dlp, FFmpeg

## 注意事項

⚠️ **重要な法的事項**:

1. **著作権の遵守**: 本アプリケーションは個人の学習目的でのみ使用してください
2. **私的利用**: 著作権法で認められた私的利用の範囲内でのみ使用すること
3. **規約の尊重**: 各プラットフォームの利用規約を確認すること
4. **非公開**: ローカル環境でのみ使用し、インターネットに公開しないこと
5. **自己責任**: 全ての利用は自己責任において行うこと

## ライセンス

個人学習目的のみ。商用利用・再配布禁止。

## 問い合わせ

問題が発生した場合は、以下を確認してください：
1. FFmpegがインストールされているか: `ffmpeg -version`
2. yt-dlpが最新版か: `yt-dlp --update`
3. Node.jsのバージョン: `node --version`
4. サーバーログを確認
