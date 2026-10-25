# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-25

### Changed

- The npm package is now published as `@sanif/pi-sound-alerts`. Install with
  `pi install npm:@sanif/pi-sound-alerts`.

## [0.1.0] - 2026-10-25

### Added

- Sound alerts when the agent finishes, asks a question, ends with an error, or
  is cancelled.
- Nine original themes: Minimal (default), Zen, Arcade, Retro OS, Sci-fi,
  Synthwave, Cartoon, Hype, and Gags (faah, huh?, sad trombone, bruh).
- `/sounds` theme picker with live preview, plus `theme`, `preview`, `set`,
  `reset`, `volume`, `on`, `off`, and `status` subcommands with tab completion.
- Per-state custom MP3/WAV files, borrowing a sound from another theme, or
  muting a single state.
- `PI_SOUND_ALERTS=0` to silence one Pi process.

[Unreleased]: https://github.com/sanif/pi-sound-alerts/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sanif/pi-sound-alerts/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sanif/pi-sound-alerts/releases/tag/v0.1.0
