# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Null Downloader is a personal web application for downloading videos and audio from YouTube and other supported platforms via yt-dlp. It uses Express.js as the backend server, with yt-dlp for downloading content and FFmpeg for media processing.

**⚠️ CRITICAL DEPENDENCIES**: This application requires both **yt-dlp** and **FFmpeg** to be installed and available in PATH. FFmpeg is essential for merging separate video and audio streams that yt-dlp downloads.

## Development Commands

### Start the server
```bash
npm start
# or
node server.js
```

Server runs on `http://localhost:3000`

### Install dependencies
```bash
npm install
```

### Verify external dependencies
```bash
yt-dlp --version
ffmpeg -version
```

## Architecture

### Backend (server.js)

The Express server exposes two main endpoints:

1. **POST /analyze** - Analyzes a URL and returns available video/audio formats
   - Uses `yt-dlp --dump-json` to extract format metadata
   - Returns video formats (with resolution/codec info) and audio formats (with bitrate)
   - Filters and sorts formats by quality
   - Results are cached for 1 hour to improve performance

2. **POST /download** - Downloads content in the selected format
   - Supports two download patterns:
     - **Pattern A**: Auto-select best quality (`format_id` not provided)
     - **Pattern B**: User-selected quality (`format_id` provided)
   - Downloads to `tmp/` directory with timestamp-based filenames
   - Uses parallel downloading (`-N 8`) and concurrent fragments (`--concurrent-fragments 8`) for speed
   - Handles three scenarios:
     - **Single file**: yt-dlp successfully merges video+audio
     - **Separate streams**: Manual FFmpeg merge required (video.mp4 + audio.m4a)
     - **Single stream**: Either video-only or audio-only file
   - Streams file to client and cleans up temporary files after sending

### Critical Workflow: FFmpeg Merging

When yt-dlp downloads video and audio as separate files (common for high-quality videos):

1. yt-dlp creates files like `{timestamp}.f{format_id}.mp4` and `{timestamp}.f{format_id}.m4a`
2. Server detects separate files in `tmp/` directory
3. Runs `ffmpeg -i video -i audio -c:v copy -c:a copy output.mp4` for fast stream copy
4. Deletes intermediate files after successful merge
5. If FFmpeg is missing, the download will fail with a clear error message

### Frontend (public/index.html)

Single-page application with two-step workflow:

1. **URL Analysis**: User enters URL → fetches format options from `/analyze`
2. **Format Selection**: User picks video quality or audio format → downloads via `/download`

The format selector presents:
- **Video group**: MP4 with resolutions (144p - 1440p), deduplicated by resolution
- **Audio group**: MP3, WAV, M4A, FLAC, AAC

### File Structure

```
Null_Downloader/
├── server.js           # Express server with /analyze and /download endpoints
├── package.json        # Node.js dependencies (express, node-cache)
├── CLAUDE.md          # Project documentation for Claude Code
├── public/
│   ├── index.html     # Frontend UI with URL input and format selector
│   └── style.css      # Styling
├── scripts/
│   └── start.bat      # Windows startup script
└── tmp/               # Temporary download storage (auto-created, auto-cleaned)
```

## Important Implementation Details

### Format Selection Logic

The server intelligently handles different format types:

- **HLS/DASH/M3U8 formats**: Used directly (already contain audio)
- **Single resolution formats** (e.g., "720p"): Used directly
- **Separate video formats**: Combines with best audio using `{format_id}+bestaudio/best`
- **Audio extraction**: Uses `--extract-audio` with specified format (mp3, wav, etc.)

### Performance Optimizations

- **Caching**: Format information cached for 1 hour using node-cache
- **Parallel downloads**: `-N 8` for 8 concurrent connections
- **Fragment parallelization**: `--concurrent-fragments 8` for faster HLS/DASH downloads
- **Cloudflare bypass**: `--extractor-args "generic:impersonate=chrome"` for browser impersonation
- **Original audio priority**: `--extractor-args "youtube:lang=orig;player_client=web"` prevents auto-dubbed audio tracks

### Cleanup Strategy

- **On success**: Files deleted after streaming to client
- **On error**: All files with matching timestamp deleted via Promise.all
- **On shutdown**: SIGINT handler cleans entire `tmp/` directory using parallel deletion

### Error Handling

Common failure scenarios:
1. **FFmpeg missing**: "FFmpegが見つかりません" error when manual merge needed
2. **yt-dlp missing**: Command execution fails
3. **Invalid URL**: Caught by frontend validation
4. **Download failed**: Server returns 500 with error details

## Language Note

This codebase uses Japanese for:
- Comments in code
- User-facing messages and error text
- README documentation

When modifying user-facing strings, maintain Japanese language for consistency.
