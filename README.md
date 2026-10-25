# pi-sound-alerts

Sound alerts for [Pi](https://github.com/earendil-works/pi). Hear when the agent
finishes, needs your answer, hits an error, or gets cancelled, with a different
sound for each.

- **5 built-in themes**, including **Reels** with meme-style voice gags: a
  *"faah"*, a *"huh?"*, a sad trombone, and a *"bruh"*.
- **Live theme picker**: `/sounds` plays each theme as you scroll through it.
- **Your own sounds**: point any state at your own MP3/WAV, borrow one sound
  from another theme, or mute it.
- **No audio files bundled**: every theme sound is synthesized from code on
  first use. The package is about 60 KB.

## Install

```bash
pi install npm:pi-sound-alerts
```

From GitHub (follows the default branch):

```bash
pi install git:github.com/sanif/pi-sound-alerts
```

Then run `/sounds` to choose a theme.

## States

| State      | When it plays                                                         |
| ---------- | --------------------------------------------------------------------- |
| `done`     | The agent finished and Pi is waiting for your next prompt             |
| `question` | The agent opened a question or confirmation dialog during a run       |
| `error`    | The run ended with an error                                           |
| `aborted`  | You cancelled the run (for example with Escape)                       |

`done` plays only once Pi has fully settled, after any automatic retries,
compaction, and queued follow-ups.

## Themes

| Theme              | done         | question       | error         | aborted        |
| ------------------ | ------------ | -------------- | ------------- | -------------- |
| `reels` (default)  | Faah         | Huh?           | Sad trombone  | Bruh           |
| `hype`             | Air horn     | Dun dun dunnn  | Boom          | Record scratch |
| `arcade`           | Power-up     | Blip blip      | Game over     | Zap            |
| `zen`              | Bell chime   | Singing bowl   | Gong          | Wood tick      |
| `minimal`          | Rising beep  | Double ping    | Falling beep  | Low blip       |

The Reels and Hype sounds are original syntheses *in the style of* popular
short-video sound gags. They are not copies of any recording.

## Commands

| Command                                         | What it does                                                |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `/sounds`                                       | Open the theme picker (↑↓ theme, ←→ state, space replay)    |
| `/sounds theme <id>`                            | Switch theme directly                                       |
| `/sounds preview [theme] [state]`               | Play a theme's sounds, or one state                         |
| `/sounds set <state> <file>`                    | Use your own MP3/WAV for a state                            |
| `/sounds set <state> theme:<id>`                | Borrow that state's sound from another theme                |
| `/sounds set <state> off`                       | Mute one state                                              |
| `/sounds reset [state\|all]`                    | Go back to theme sounds                                     |
| `/sounds volume <0-100>`                        | Set the volume                                              |
| `/sounds on` / `/sounds off`                    | Turn alerts on or off                                       |
| `/sounds status`                                | Show the current settings                                   |

Tab completion works for subcommands, themes, and states.

### Mix and match

```text
/sounds theme zen
/sounds set done ~/Music/faah.mp3
/sounds set error theme:hype
/sounds set question off
```

That plays your own clip when the agent finishes, the Hype "boom" on errors,
nothing for questions, and the Zen wood tick on cancel.

## Configuration

Settings live in `~/.pi/agent/pi-sound-alerts.json`. `/sounds` writes this file
for you, but you can also edit it by hand; changes apply on the next alert.

```json
{
	"enabled": true,
	"theme": "reels",
	"volume": 0.7,
	"modes": ["tui"],
	"sounds": {
		"done": "~/Music/faah.mp3",
		"error": "theme:hype",
		"question": false
	}
}
```

| Key       | Default     | Meaning                                                                                   |
| --------- | ----------- | ----------------------------------------------------------------------------------------- |
| `enabled` | `true`      | Master switch                                                                             |
| `theme`   | `"reels"`   | One of `reels`, `hype`, `arcade`, `zen`, `minimal`                                        |
| `volume`  | `0.7`       | Playback volume, `0` to `1`                                                               |
| `modes`   | `["tui"]`   | Pi modes that play sounds: `tui`, `rpc`, `json`, `print`                                  |
| `sounds`  | `{}`        | Per-state override: a file path, `"theme:<id>"`, or `false` to mute                       |

File paths may start with `~/`. Relative paths are resolved against
`~/.pi/agent/`. If a custom file goes missing, the theme sound plays instead and
Pi shows a warning once.

By default only the interactive terminal UI plays sounds. Subagents and scripted
runs use `json` or `print` mode, so they don't play sounds over your main
session. Add `"rpc"` to `modes` if you drive Pi from an RPC client.

Set `PI_SOUND_ALERTS=0` in the environment to silence one Pi process without
changing the config.

## Platforms

- **macOS**: uses the built-in `afplay`.
- **Linux**: uses the first available of `pw-play`, `paplay`, `ffplay`, `mpv`,
  or `aplay` (WAV only). For MP3 files, `ffplay` or `mpv` is preferred.

Rendered theme sounds are cached in `~/.pi/agent/cache/pi-sound-alerts/`.

## Development

```bash
bun install
bun run verify   # typecheck, tests, package dry run
```

## License

MIT
