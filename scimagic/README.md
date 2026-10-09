# SciMagic — GitHub Pages版

このフォルダーの中身を、既存のGitHub Pagesリポジトリの `scimagic/` フォルダーに追加してください。既存のトップページを上書きする必要はありません。

公開先の想定： https://kkpp0515-ai.github.io/20260302_001/scimagic/

HTMLをダブルクリックするのではなく、GitHub PagesのHTTPS URLから開いてください。PCのChrome・Edge向けです。Node.jsやFFmpegのインストールは不要です。

動画はサーバーに送信されません。初回は動画処理エンジン約32MBを読み込み、以後も動画の処理は各自のブラウザーで行います。100MB以下の短いMP4でお試しください。メモリ使用量は入力ファイルサイズより大きくなります。処理中はタブを閉じないでください。

1. MP4を選択し、最終フレームが出るまで待つ。
2. 自由入力側で改行と強調行を指定。文字・背景をドラッグし、サイズ・角度を調整。
3. 固定PNG側の配置を調整。「背景・文字の読みやすさ」で、カットごとの階調反転・暗さ・ノイズ・文字の影を調整。固定文字のPNGには影が入っています。
4. 「3秒＋SEを確認」で確認。
5. 「この配置で動画を生成」後、「MP4を保存」。

元動画は全編使用し、最後に各1.5秒の静止カットを追加します。10秒の動画なら13秒になります。元音声を保持し、SEは追加シーンから再生します。

`vendor/core`の.binファイルは同梱エンジンを4MBずつ分割したものです。すべて配置してください（GitHubのブラウザーでアップロードできるサイズに分割しています）。エンジンは単一スレッド版を使い、GitHub Pagesで追加のHTTPヘッダー設定を必要としません。

## 同梱ソフトウェア

- @ffmpeg/ffmpeg 0.12.15 — MIT。本文はlicenses/ffmpeg-wrapper-MIT.txt。
- @ffmpeg/core 0.12.10 — GPL-2.0-or-later。本文はlicenses/ffmpeg-core-GPLv2.txt。
- つなぎゴシック — SIL OFL 1.1。本文はfonts/OFL.txt。

エンジンのソース・ビルド手順：
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/core%400.12.10
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/ffmpeg%400.12.15
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/core%400.12.10/packages/core

このHTML、editor.js、engine.jsがアプリ側のソースです。PNG・SEは提供された素材を同梱しています。
