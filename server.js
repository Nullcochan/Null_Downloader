const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, createReadStream } = require('fs');
const NodeCache = require('node-cache');

// ==================== 設定 ====================
const app = express();
const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, 'tmp');

// フォーマット情報キャッシュ（TTL: 1時間）
const formatCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// yt-dlp高速化設定
const YTDLP_OPTIONS = {
  connections: 16,              // 並列接続数
  fragments: 16,                // 並列フラグメント数
  bufferSize: '16K',           // バッファサイズ
  chunkSize: '10M',            // HTTPチャンクサイズ
  throttledRate: '100K',       // 帯域制限閾値
  extractorRetries: 3,         // Extractorリトライ回数
  fileAccessRetries: 3         // ファイルアクセスリトライ回数
};

// ミドルウェア設定
app.use(express.json());
app.use(express.static('public'));

// ==================== ヘルパー関数 ====================

// 一時ディレクトリ初期化
function initTmpDir() {
  if (!existsSync(TMP_DIR)) {
    require('fs').mkdirSync(TMP_DIR, { recursive: true });
  }
}

// yt-dlpコマンド構築
function buildYtDlpCommand(url, formatSelector, downloadType, audioFormat, outputPath) {
  const baseOptions = [
    '--no-playlist',
    `-N ${YTDLP_OPTIONS.connections}`,
    `--concurrent-fragments ${YTDLP_OPTIONS.fragments}`,
    `--buffer-size ${YTDLP_OPTIONS.bufferSize}`,
    `--http-chunk-size ${YTDLP_OPTIONS.chunkSize}`,
    `--throttled-rate ${YTDLP_OPTIONS.throttledRate}`,
    `--extractor-retries ${YTDLP_OPTIONS.extractorRetries}`,
    `--file-access-retries ${YTDLP_OPTIONS.fileAccessRetries}`,
    // オリジナル音声を優先（自動吹き替えを回避）
    '--extractor-args "youtube:player_client=web"'
  ].join(' ');

  if (downloadType === 'audio') {
    return `yt-dlp ${baseOptions} -f "${formatSelector}" --extract-audio --audio-format ${audioFormat} --audio-quality 0 -o "${outputPath}" "${url}"`;
  } else {
    return `yt-dlp ${baseOptions} -f "${formatSelector}" --merge-output-format mp4 -o "${outputPath}" "${url}"`;
  }
}

// フォーマットセレクター決定
function determineFormatSelector(formatId, downloadType) {
  if (!formatId) {
    // 日本語音声トラックを優先、フォールバックで全言語対応
    return downloadType === 'audio'
      ? 'bestaudio[language=ja][ext=m4a]/bestaudio[language=ja]/bestaudio[ext=m4a]/bestaudio'
      : 'bestvideo[ext=mp4]+bestaudio[language=ja]/bestvideo+bestaudio[language=ja]/bestvideo[ext=mp4]+bestaudio/best';
  }

  if (downloadType === 'audio') {
    return formatId;
  }

  // 動画の場合: ストリーミング形式判定
  const isStreamingFormat =
    formatId.includes('hls-') ||
    formatId.includes('dash-') ||
    formatId.includes('m3u8') ||
    formatId.match(/^\d+p$/);

  if (isStreamingFormat) {
    console.log(`[Format] Streaming format detected: ${formatId}`);
    return formatId;
  } else {
    console.log(`[Format] Separate format, adding Japanese audio: ${formatId}+bestaudio[language=ja]`);
    // 日本語音声を優先、フォールバックで全言語対応
    return `${formatId}+bestaudio[language=ja]/${formatId}+bestaudio/best`;
  }
}

// ファイル名サニタイズ
function sanitizeFilename(title, ext) {
  if (!title) return `download_${Date.now()}.${ext}`;
  const sanitized = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return `${sanitized}.${ext}`;
}

// 中間ファイル検出
async function findIntermediateFiles(timestamp, tmpDir) {
  const tmpFiles = await fs.readdir(tmpDir);
  const videoFiles = tmpFiles.filter(f =>
    f.startsWith(`${timestamp}.f`) && (f.endsWith('.mp4') || f.endsWith('.webm'))
  );
  const audioFiles = tmpFiles.filter(f =>
    f.startsWith(`${timestamp}.f`) && (f.endsWith('.m4a') || f.endsWith('.webm'))
  );
  return { videoFiles, audioFiles, tmpFiles };
}

// FFmpeg手動マージ
async function mergeFiles(videoPath, audioPath, outputPath) {
  const mergeCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c copy -movflags +faststart "${outputPath}"`;
  console.log(`[Merge] ${mergeCommand}`);

  try {
    await execCommand(mergeCommand);
    console.log('[Merge] Success');
    await Promise.all([fs.unlink(videoPath), fs.unlink(audioPath)]);
    console.log('[Cleanup] Intermediate files deleted');
  } catch (error) {
    console.error('[Merge Error]', error.message);
    throw new Error('FFmpegが見つかりません。FFmpegをインストールしてPATHに追加してください。');
  }
}

// タイムスタンプ関連ファイル一括削除
async function cleanupTimestampFiles(timestamp, tmpDir) {
  try {
    const tmpFiles = await fs.readdir(tmpDir);
    const filesToDelete = tmpFiles
      .filter(file => file.startsWith(`${timestamp}`))
      .map(file => path.join(tmpDir, file));

    await Promise.all(
      filesToDelete.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
          console.log(`[Cleanup] Deleted: ${path.basename(filePath)}`);
        } catch (err) {
          console.error(`[Cleanup Error] ${path.basename(filePath)}:`, err.message);
        }
      })
    );
  } catch (error) {
    console.error('[Cleanup Error]', error);
  }
}

// コマンド実行
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        if (stdout && stdout.trim()) {
          console.log('[Command] Warning (stderr present):', stderr);
          resolve(stdout);
          return;
        }
        console.error('[Command Error]', stderr || error.message);
        reject(new Error(stderr || error.message));
        return;
      }
      if (stderr && stderr.trim()) {
        console.log('[Command] Warning:', stderr);
      }
      resolve(stdout);
    });
  });
}

initTmpDir();

// ==================== エンドポイント ====================

// ダウンロードエンドポイント
app.post('/download', async (req, res) => {
  const { url, format_id, download_type, audio_format, title } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URLが指定されていません' });
  }

  const timestamp = Date.now();
  const expectedExt = download_type === 'audio' ? (audio_format || 'mp3') : 'mp4';
  const contentType = download_type === 'audio'
    ? (expectedExt === 'wav' ? 'audio/wav' : 'audio/mpeg')
    : 'video/mp4';
  const outputPath = path.join(TMP_DIR, `${timestamp}.${expectedExt}`);

  console.log(`[Download] URL: ${url}, Format: ${format_id || 'auto'}, Type: ${download_type || 'video'}`);

  try {
    // フォーマットセレクター決定
    const formatSelector = determineFormatSelector(format_id, download_type);

    // yt-dlpコマンド構築・実行
    const ytDlpCommand = buildYtDlpCommand(url, formatSelector, download_type, expectedExt, outputPath);
    console.log(`[Execute] ${ytDlpCommand}`);
    await execCommand(ytDlpCommand);

    // ファイル確認・マージ処理
    if (!existsSync(outputPath)) {
      console.log('[Check] Output not found, checking intermediate files...');
      const { videoFiles, audioFiles } = await findIntermediateFiles(timestamp, TMP_DIR);

      if (videoFiles.length > 0 && audioFiles.length > 0) {
        // 手動マージ必要
        console.log('[Merge] Manual merge required');
        await mergeFiles(
          path.join(TMP_DIR, videoFiles[0]),
          path.join(TMP_DIR, audioFiles[0]),
          outputPath
        );
      } else if (videoFiles.length > 0 || audioFiles.length > 0) {
        // 単一ファイルのみ存在
        const singleFile = videoFiles.length > 0 ? videoFiles[0] : audioFiles[0];
        console.log(`[Rename] ${singleFile} → ${path.basename(outputPath)}`);
        await fs.rename(path.join(TMP_DIR, singleFile), outputPath);
      } else {
        throw new Error('ダウンロードファイルが見つかりません');
      }
    }

    console.log(`[Success] ${outputPath}`);

    // ストリーミング送信
    const stats = await fs.stat(outputPath);
    const filename = sanitizeFilename(title, expectedExt);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', stats.size);

    const fileStream = createReadStream(outputPath);

    fileStream.on('error', (error) => {
      console.error('[Stream Error]', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'ファイル送信エラー' });
      }
    });

    fileStream.on('end', async () => {
      console.log('[Stream] Complete, cleaning up...');
      try {
        await fs.unlink(outputPath);
        console.log('[Cleanup] Success');
      } catch (err) {
        console.error('[Cleanup Error]', err);
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('[Download Error]', error);
    await cleanupTimestampFiles(timestamp, TMP_DIR);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'ダウンロードに失敗しました',
        details: error.message
      });
    }
  }
});

// URL解析エンドポイント
app.post('/analyze', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URLが指定されていません' });
  }

  console.log(`[Analyze] URL: ${url}`);

  const cacheKey = `format_${url}`;

  try {
    // キャッシュチェック
    const cachedData = formatCache.get(cacheKey);
    if (cachedData) {
      console.log('[Cache] Hit');
      return res.json(cachedData);
    }

    console.log('[Cache] Miss, fetching...');

    // yt-dlp実行
    const ytDlpCommand = `yt-dlp --dump-json --no-playlist "${url}"`;
    const jsonOutput = await execCommand(ytDlpCommand);
    const videoInfo = JSON.parse(jsonOutput);

    const formats = videoInfo.formats || [];

    // 動画フォーマット抽出
    const videoFormats = formats
      .filter(f => f.vcodec !== 'none' && f.height)
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: `${f.height}p`,
        height: f.height,
        fps: f.fps || 'N/A',
        vcodec: f.vcodec,
        acodec: f.acodec,
        filesize: f.filesize || f.filesize_approx || null,
        format_note: f.format_note || ''
      }))
      .sort((a, b) => b.height - a.height);

    // 音声フォーマット抽出
    const audioFormats = formats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        abr: f.abr || 'N/A',
        acodec: f.acodec,
        filesize: f.filesize || f.filesize_approx || null,
        format_note: f.format_note || ''
      }))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));

    const responseData = {
      success: true,
      video_info: {
        title: videoInfo.title,
        duration: videoInfo.duration,
        thumbnail: videoInfo.thumbnail,
        uploader: videoInfo.uploader,
        view_count: videoInfo.view_count
      },
      video_formats: videoFormats,
      audio_formats: audioFormats
    };

    formatCache.set(cacheKey, responseData);
    console.log(`[Success] ${videoFormats.length} video, ${audioFormats.length} audio formats`);

    res.json(responseData);

  } catch (error) {
    console.error('[Analyze Error]', error);
    res.status(500).json({
      error: 'URL解析に失敗しました',
      details: error.message
    });
  }
});

// ==================== サーバー起動 ====================

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Null Downloader Server Started 🚀  ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  URL: http://localhost:${PORT}            ║`);
  console.log(`║  Connections: ${YTDLP_OPTIONS.connections}x parallel         ║`);
  console.log(`║  Fragments: ${YTDLP_OPTIONS.fragments}x concurrent       ║`);
  console.log('╚════════════════════════════════════════╝');
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Cleaning up...');
  try {
    const files = await fs.readdir(TMP_DIR);
    await Promise.all(
      files.map(file => fs.unlink(path.join(TMP_DIR, file)).catch(err => {
        console.error(`[Shutdown] Failed to delete ${file}:`, err);
      }))
    );
    console.log('[Shutdown] Complete');
  } catch (error) {
    console.error('[Shutdown Error]', error);
  }
  process.exit(0);
});
