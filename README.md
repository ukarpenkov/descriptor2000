# Descriptor2000

Desktop application for local transcription of audio and video. Files stay on the machine. Speech recognition runs on the CPU. The interface is in Russian. License: MIT. Third-party notices: `THIRD_PARTY_NOTICES.md`.

Current release: 3.0.2. A successful build of `main` publishes a new GitHub release, and the links below point at that release. While a build is still running, the links serve the previous release. Build status: [Desktop builds](https://github.com/ukarpenkov/descriptor2000/actions/workflows/build.yml).

## Download

Installers are unsigned. macOS builds run on Apple Silicon (`macos-latest`). Windows builds are x64 NSIS (`windows-latest`). There is no Intel macOS, Windows ARM, Linux, mobile, or browser build.

- [Windows, x64](https://github.com/ukarpenkov/descriptor2000/releases/latest/download/Descriptor2000-windows.exe)
- [macOS, Apple Silicon](https://github.com/ukarpenkov/descriptor2000/releases/latest/download/Descriptor2000-mac.dmg)

### macOS

Open the DMG and copy `Descriptor2000` to Applications. Gatekeeper blocks the first launch because the app has no Apple certificate. The Privacy & Security confirmation and the Finder Open item do not clear that block. Sign the copied app locally, then launch it from the icon. Repeat the command after replacing the app:

```sh
codesign --force --deep --sign - /Applications/Descriptor2000.app
```

### Windows

Run the EXE. The installer asks for a directory (`oneClick` is off). If SmartScreen blocks the file, choose More info, then Run anyway. The app starts from the Start menu.

The first model download needs a network connection. Models are stored under `models` in the Electron user-data directory. Extracted PCM uses about 230 MB of temporary disk per hour of audio and is removed when the job finishes or is cancelled.

## Stack

Electron 39, React 19, TypeScript, Vite 7. Packaged with electron-builder. Node.js 24 (`.nvmrc`).

Recognition runs in a worker thread, off the UI thread. FFmpeg (`ffmpeg-static`) writes mono float32 PCM at 16 kHz. The worker reads 25-second chunks. GigaAM v3 (`istupakov/gigaam-v3-onnx`, int8, about 230 MB) is loaded with `onnx-asr-web`. It transcribes Russian only and does not translate. Whisper Tiny, Base, and Small (`onnx-community/whisper-*`) are loaded with `@huggingface/transformers` at `q8` on CPU. Whisper languages: automatic, Russian, English, Spanish, French, German. Whisper can translate speech into English.

The renderer has no Node.js access. Preload exposes a small IPC surface. `electron/service.ts` is an Elysia app (`elysia`, `@elysiajs/node`, `@sinclair/typebox`) called with `app.handle(Request)` in-process. No TCP port is opened.

Accepted extensions: MP4, MP3, M4A, WAV, AAC, AMR, 3GP, OGG, OPUS, FLAC, MOV, MKV, WEBM, CAF, AIFF, WMA. Support depends on the codec. Encrypted files are rejected. Up to 30 files per job. Output is timestamped plain text, copied or saved as TXT. Light and dark themes.

## Run from source

Git, Node.js 24, and npm. Build on the operating system you need an installer for.

```sh
git clone https://github.com/ukarpenkov/descriptor2000.git
cd descriptor2000
npm ci
npm run dev
```

`npm run dev` typechecks, builds, and opens one window. Pick or drop files, choose a model and language, then start transcription. The model button downloads or checks the selected model before a job.

Installer for the current OS (`release/`):

```sh
npm test
npm run build
npm run dist -- --publish never
npm run test:packaged
```
