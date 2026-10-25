# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-25

### Added

- Sound alerts when the agent finishes, asks a question, ends with an error, or
  is cancelled.
- Five original themes: Reels (faah, huh?, sad trombone, bruh), Hype, Arcade,
  Zen, and Minimal.
- `/sounds` theme picker with live preview, plus `theme`, `preview`, `set`,
  `reset`, `volume`, `on`, `off`, and `status` subcommands with tab completion.
- Per-state custom MP3/WAV files, borrowing a sound from another theme, or
  muting a single state.
- `PI_SOUND_ALERTS=0` to silence one Pi process.

[Unreleased]: https://github.com/sanif/pi-sound-alerts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sanif/pi-sound-alerts/releases/tag/v0.1.0
