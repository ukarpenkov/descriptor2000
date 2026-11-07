# Third-party components

Descriptor2000 code is MIT licensed. Bundled dependencies retain their own licenses.

- Electron: MIT, Chromium/Node.js and associated notices supplied by Electron.
- React: MIT.
- Elysia and its Node adapter: MIT.
- Transformers.js: Apache-2.0. ONNX Runtime: MIT. Other transitive dependencies keep their notices.
- Whisper weights: consult the source model card/license for every distributed model. Models are downloaded on demand, not included in this repository.
- ffmpeg-static npm wrapper: GPL-3.0-or-later. Bundled FFmpeg builds may contain GPL components. See https://github.com/eugeneware/ffmpeg-static and https://ffmpeg.org/legal.html for license obligations and corresponding sources. A distributed installer must include required notices and access to corresponding FFmpeg source/build information; do not treat the binary as MIT.

This file identifies major dependencies; retain package license files and Electron license resources in distributions. Release compliance and code signing are pending release tasks.
