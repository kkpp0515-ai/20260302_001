# SciMagic localization studio

Draft implementation for `video-resize-ffmpeg/`. Do not deploy until the assets below have been added and browser / FFmpeg-WASM checks pass.

## Behavior

- Pick a registered title and one source video.
- Select Japanese, Traditional Chinese, Korean, and/or English with checkboxes.
- Select square, landscape, and/or portrait outputs.
- Apply the language-specific obi02 frame for square / landscape and append the language-specific rc006 end card.
- Portrait uses no frame because no portrait frame was supplied.
- Source video defaults to the height of the largest transparent rectangle in the frame. Drag and zoom are shared across languages per output size.
- End cards use their actual decoded durations and fit fully within the transparent opening.
- Output H.264 / AAC MP4 files are available individually or via sequential downloads.
- Conversion can be cancelled; completed results remain downloadable.

## Pending assets

Copy all 12 supplied files into `assets/scimagic/`, retaining their filenames:

For each language `ja`, `zh-TW`, `ko`, `en`:

- `scimagic_<language>_obi02_1080-1080.png`
- `scimagic_<language>_obi02_1920-1080.png`
- `scimagic_<language>_rc006_1080-1920.mp4`

The Windows execution environment disconnected during transfer. The PNG files and English MP4 had been downloaded locally; the other MP4 transfers were in progress. These binary assets have not yet been committed. No expiring download links or credentials are stored in this branch.

## Validation and completion

JavaScript syntax and 48 filter-command combinations (sizes, band/end-card flags, independent audio presence) can be checked without browser dependencies. Actual media conversion, FFmpeg-WASM loading, preview layout, cancel/retry, language selection, and downloads must be verified after reconnection.

Use an HTTP server from the repository root for preview (the app loads the existing shared theme and FFmpeg wrapper under `influencer-video-ffmpeg/vendor/`). Keep deployment on the existing GitHub Pages site and retain the current public version until validation is complete.
