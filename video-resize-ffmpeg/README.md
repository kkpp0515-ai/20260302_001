# Video localization studio

Title-driven, browser-local MP4 generation for the existing GitHub Pages workspace.

## Usage

1. Select SciMagic and choose one source video.
2. Check the languages and output sizes needed.
3. Confirm the composition; optional drag, zoom, and fit controls are shared across languages per size.
4. Generate and save the resulting MP4 files individually or with the multi-download button.

The catalog registers Japanese, Traditional Chinese, Korean, and English. Each language has square / landscape obi02 PNG frames and a portrait rc006 video appended in full. Portrait outputs use no frame. End-card video is fitted inside the frame opening without cropping.

## Adding a title

Add an entry to catalog.json with an id, label, language list, and per-language bands/endcard URLs. Keep paths relative to this directory. Runtime video metadata supplies end-card dimensions and duration; largest transparent rectangles are detected from PNG alpha.

## Engine and media

FFmpeg core 0.12.10 is vendored in vendor/ to avoid dependence on a third-party CDN at runtime. The existing FFmpeg JavaScript wrapper and worker are reused from ../influencer-video-ffmpeg/vendor/.

The supplied 1080x1920 end cards retain their full duration and dimensions; copies served here are H.264 CRF20 / AAC160k with fast-start metadata. The supplied PNGs are unchanged.

See vendor/README.md for engine source and license information.

## Verification (2026-10-26)

- JavaScript syntax and 48 command-construction combinations.
- Browser: full 21-second English end-card append, MP4 download and H.264/AAC 1080x1080 / 21.513-second verification.
- Browser: all four languages across three sizes, 12 completed outputs with end-card append disabled for this short fixture.
- Browser: language checkbox exclusion, live output count, title/frame preview, all four end-card assets, cancellation with completed results retained.
- Native FFmpeg: actual frame and end-card conversion to all three sizes with audio and expected duration.

Serve the repository root over HTTP for local development. The source video is processed locally; it is never uploaded to a conversion server.
