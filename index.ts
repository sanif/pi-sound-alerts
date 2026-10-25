import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
	AgentActivityOutcome,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { type AutocompleteItem, Container, Key, matchesKey, SelectList, Text } from "@earendil-works/pi-tui";
import {
	clampVolume,
	configPath,
	isAlertState,
	loadConfig,
	resolveSoundPath,
	type SoundConfig,
	saveConfig,
	themeReference,
} from "./config";
import { Player, themeSoundFile } from "./player";
import { ALERT_STATES, type AlertState, findTheme, STATE_LABELS, THEMES, type Theme } from "./themes";

export interface SoundAlertsOptions {
	agentDir?: string;
	player?: Player;
	/** Delay between sounds when previewing a theme, in milliseconds per second of audio. */
	sleep?: (ms: number) => Promise<void>;
}

export interface ResolvedSound {
	file?: string;
	/** Human-readable source, e.g. "Reels: Faah" or a file path. */
	label: string;
	warning?: string;
}

const SUBCOMMANDS: ReadonlyArray<{ name: string; description: string }> = [
	{ name: "theme", description: "Pick a theme (live preview)" },
	{ name: "preview", description: "Play a theme's sounds" },
	{ name: "set", description: "Use a custom file, another theme, or off for one state" },
	{ name: "reset", description: "Restore theme sounds for one state or all" },
	{ name: "volume", description: "Set volume 0-100" },
	{ name: "on", description: "Turn sound alerts on" },
	{ name: "off", description: "Turn sound alerts off" },
	{ name: "status", description: "Show current settings" },
];

const DISABLED_ENV = new Set(["0", "off", "false", "no"]);

function wavSeconds(file: string): number | undefined {
	if (!file.endsWith(".wav")) return undefined;
	try {
		return Math.max(0, statSync(file).size - 44) / 2 / 44_100;
	} catch {
		return undefined;
	}
}

/** Decide which file plays for a state under the given config. */
export function resolveSound(
	config: SoundConfig,
	state: AlertState,
	paths: { configDir: string; cacheDir: string },
): ResolvedSound {
	const theme = findTheme(config.theme) ?? THEMES[0]!;
	const fromTheme = (source: Theme): ResolvedSound => ({
		file: themeSoundFile(source, state, paths.cacheDir),
		label: `${source.name}: ${source.labels[state]}`,
	});
	const override = config.sounds[state];
	if (override === false) return { label: "muted" };
	if (typeof override === "string") {
		const borrowed = themeReference(override);
		if (borrowed !== undefined) return fromTheme(findTheme(borrowed) ?? theme);
		const file = resolveSoundPath(override, paths.configDir);
		if (existsSync(file)) return { file, label: file };
		return { ...fromTheme(theme), warning: `Custom ${state} sound not found: ${file}` };
	}
	return fromTheme(theme);
}

export function describeConfig(config: SoundConfig, paths: { configDir: string; cacheDir: string }, file: string): string {
	const theme = findTheme(config.theme) ?? THEMES[0]!;
	const lines = [
		`Sound alerts ${config.enabled ? "on" : "off"} · theme ${theme.name} · volume ${Math.round(config.volume * 100)}%`,
	];
	for (const state of ALERT_STATES) {
		const override = config.sounds[state];
		const label =
			override === false
				? "muted"
				: typeof override === "string"
					? themeReference(override) !== undefined
						? resolveSound(config, state, paths).label
						: `custom ${override}`
					: theme.labels[state];
		lines.push(`  ${state.padEnd(8)} ${label}`);
	}
	lines.push(`Config: ${file}`);
	return lines.join("\n");
}

function completions(prefix: string): AutocompleteItem[] | null {
	const parts = prefix.trimStart().split(/\s+/);
	const pick = (head: string, values: ReadonlyArray<{ value: string; description?: string }>) => {
		const last = parts[parts.length - 1]!.toLowerCase();
		const items = values
			.filter((item) => item.value.startsWith(last))
			.map((item) => ({ value: `${head}${item.value}`, label: item.value, description: item.description }));
		return items.length > 0 ? items : null;
	};
	const themes = THEMES.map((theme) => ({ value: theme.id, description: theme.description }));
	const states = ALERT_STATES.map((state) => ({ value: state, description: STATE_LABELS[state] }));
	if (parts.length <= 1) {
		return pick("", SUBCOMMANDS.map((command) => ({ value: command.name, description: command.description })));
	}
	const [command, second] = parts;
	if (parts.length === 2) {
		if (command === "theme") return pick("theme ", themes);
		if (command === "preview") return pick("preview ", themes);
		if (command === "set") return pick("set ", states);
		if (command === "reset") return pick("reset ", [...states, { value: "all", description: "Every state" }]);
		if (command === "volume") return pick("volume ", ["25", "50", "70", "100"].map((value) => ({ value })));
	}
	if (parts.length === 3) {
		if (command === "preview") return pick(`preview ${second} `, states);
		if (command === "set") {
			return pick(`set ${second} `, [
				{ value: "off", description: "Mute this state" },
				...THEMES.map((theme) => ({
					value: `theme:${theme.id}`,
					description: isAlertState(second ?? "") ? theme.labels[second as AlertState] : theme.name,
				})),
			]);
		}
	}
	return null;
}

export function createSoundAlerts(options: SoundAlertsOptions = {}) {
	return function soundAlerts(pi: ExtensionAPI): void {
		const agentDir = () => options.agentDir ?? getAgentDir();
		const file = () => configPath(agentDir());
		const paths = () => ({ configDir: dirname(file()), cacheDir: join(agentDir(), "cache", "pi-sound-alerts") });
		const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
		let player = options.player;
		const getPlayer = () => {
			player ??= new Player();
			return player;
		};
		const shownWarnings = new Set<string>();
		let running = false;
		let pickerOpen = false;
		let outcome: AgentActivityOutcome = "completed";

		function warnOnce(ctx: ExtensionContext, message: string): void {
			if (shownWarnings.has(message)) return;
			shownWarnings.add(message);
			if (ctx.hasUI) ctx.ui.notify(`Sound alerts: ${message}`, "warning");
		}

		function read(ctx: ExtensionContext): SoundConfig {
			const loaded = loadConfig(file());
			for (const warning of loaded.warnings) warnOnce(ctx, warning);
			return loaded.config;
		}

		function write(config: SoundConfig): void {
			saveConfig(file(), config);
		}

		/** Play one state's sound; returns its audio length in seconds when known. */
		function play(ctx: ExtensionContext, config: SoundConfig, state: AlertState): number | undefined {
			let sound: ResolvedSound;
			try {
				sound = resolveSound(config, state, paths());
			} catch (error) {
				warnOnce(ctx, `could not prepare ${state} sound: ${(error as Error).message}`);
				return undefined;
			}
			if (sound.warning) warnOnce(ctx, sound.warning);
			if (!sound.file) return undefined;
			const used = getPlayer().play(sound.file, config.volume);
			if (!used) {
				warnOnce(ctx, "no audio player found (install ffplay, mpv, pw-play, paplay, or aplay)");
				return undefined;
			}
			return wavSeconds(sound.file);
		}

		function alert(ctx: ExtensionContext, state: AlertState): void {
			if (DISABLED_ENV.has((process.env.PI_SOUND_ALERTS ?? "").trim().toLowerCase())) return;
			const config = read(ctx);
			if (!config.enabled || !config.modes.includes(ctx.mode)) return;
			play(ctx, config, state);
		}

		pi.on("agent_start", () => {
			running = true;
			outcome = "completed";
		});

		pi.on("agent_before_settle", (event) => {
			outcome = event.outcome;
		});

		pi.on("agent_settled", (event, ctx) => {
			running = false;
			const state: AlertState = event.aborted ? "aborted" : outcome === "error" ? "error" : "done";
			outcome = "completed";
			alert(ctx, state);
		});

		// Questions and confirmations the agent raises mid-run. Dialogs opened
		// by user commands while Pi is idle are not "waiting on you" moments.
		pi.on("ui_prompt_start", (_event, ctx) => {
			if (running && !pickerOpen) alert(ctx, "question");
		});

		pi.on("session_shutdown", () => {
			running = false;
		});

		async function preview(ctx: ExtensionContext, config: SoundConfig, states: readonly AlertState[]) {
			for (const [index, state] of states.entries()) {
				const seconds = play(ctx, config, state);
				if (index < states.length - 1) await sleep(Math.round(((seconds ?? 2) + 0.35) * 1000));
			}
		}

		async function pickTheme(ctx: ExtensionCommandContext, config: SoundConfig): Promise<void> {
			const initial = Math.max(
				0,
				THEMES.findIndex((theme) => theme.id === config.theme),
			);
			pickerOpen = true;
			const chosen = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
				let stateIndex = 0;
				const items = THEMES.map((item) => ({
					value: item.id,
					label: item.name,
					description: item.description,
				}));
				const list = new SelectList(items, items.length, {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});
				list.setSelectedIndex(initial);
				const now = new Text("", 1, 0);
				const selected = () => findTheme(list.getSelectedItem()?.value ?? "") ?? THEMES[initial]!;
				const listen = () => {
					const current = selected();
					const state = ALERT_STATES[stateIndex]!;
					now.setText(
						theme.fg("muted", `♪ ${STATE_LABELS[state]}: `) + theme.fg("accent", current.labels[state]),
					);
					// Preview the theme's own sound even if this state has a custom override.
					play(ctx, { ...config, theme: current.id, sounds: {} }, state);
					tui.requestRender();
				};
				list.onSelectionChange = listen;
				list.onSelect = (item) => done(item.value);
				list.onCancel = () => done(null);
				const container = new Container();
				container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Sound alert theme")), 1, 0));
				container.addChild(list);
				container.addChild(now);
				container.addChild(
					new Text(
						theme.fg("dim", "↑↓ theme · ←→ switch sound · space replay · enter apply · esc cancel"),
						1,
						0,
					),
				);
				container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
				listen();
				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput(data: string) {
						if (matchesKey(data, Key.left) || matchesKey(data, Key.right)) {
							const step = matchesKey(data, Key.left) ? -1 : 1;
							stateIndex = (stateIndex + step + ALERT_STATES.length) % ALERT_STATES.length;
							listen();
							return;
						}
						if (matchesKey(data, Key.space)) {
							listen();
							return;
						}
						list.handleInput(data);
						tui.requestRender();
					},
				};
			}).finally(() => {
				pickerOpen = false;
			});
			if (!chosen) return;
			const next = { ...read(ctx), theme: chosen, enabled: true };
			write(next);
			ctx.ui.notify(`Sound theme set to ${findTheme(chosen)?.name ?? chosen}`, "info");
		}

		pi.registerCommand("sounds", {
			description: "Sound alerts: pick a theme, preview, or set custom sounds",
			getArgumentCompletions: completions,
			handler: async (args, ctx) => {
				const [command = "", ...rest] = args.trim().split(/\s+/).filter(Boolean);
				const config = read(ctx);
				const say = (message: string, level: "info" | "warning" | "error" = "info") =>
					ctx.ui.notify(message, level);
				const usage = () =>
					say(
						[
							"Usage: /sounds [theme [id] | preview [theme] [state] | set <state> <file|theme:id|off> |",
							"        reset [state|all] | volume <0-100> | on | off | status]",
							`Themes: ${THEMES.map((theme) => theme.id).join(", ")}`,
							`States: ${ALERT_STATES.join(", ")}`,
						].join("\n"),
					);

				switch (command.toLowerCase()) {
					case "":
					case "theme": {
						const id = rest[0];
						if (id) {
							const theme = findTheme(id);
							if (!theme) return say(`Unknown theme "${id}". Try: ${THEMES.map((t) => t.id).join(", ")}`, "warning");
							write({ ...config, theme: theme.id, enabled: true });
							say(`Sound theme set to ${theme.name}`);
							play(ctx, { ...config, theme: theme.id }, "done");
							return;
						}
						if (ctx.mode === "tui") return pickTheme(ctx, config);
						return say(describeConfig(config, paths(), file()));
					}
					case "preview": {
						let target = config;
						let states: readonly AlertState[] = ALERT_STATES;
						for (const word of rest) {
							const theme = findTheme(word);
							if (theme) target = { ...config, theme: theme.id, sounds: {} };
							else if (isAlertState(word)) states = [word];
							else return say(`Unknown theme or state "${word}"`, "warning");
						}
						const theme = findTheme(target.theme) ?? THEMES[0]!;
						say(`Previewing ${theme.name}: ${states.map((state) => `${state} (${resolveSound(target, state, paths()).label})`).join(", ")}`);
						await preview(ctx, target, states);
						return;
					}
					case "set": {
						const [state, ...valueParts] = rest;
						const value = valueParts.join(" ").trim();
						if (!state || !isAlertState(state) || !value) {
							return say("Usage: /sounds set <done|question|error|aborted> <file.mp3|theme:id|off>", "warning");
						}
						let override: string | false;
						if (["off", "mute", "none", "false"].includes(value.toLowerCase())) override = false;
						else if (themeReference(value) !== undefined) {
							const borrowed = findTheme(themeReference(value)!);
							if (!borrowed) return say(`Unknown theme in "${value}"`, "warning");
							override = `theme:${borrowed.id}`;
						} else {
							const resolved = resolveSoundPath(value, paths().configDir);
							if (!existsSync(resolved)) return say(`File not found: ${resolved}`, "warning");
							override = value;
						}
						const next = { ...config, sounds: { ...config.sounds, [state]: override } };
						write(next);
						say(`${state} → ${override === false ? "muted" : resolveSound(next, state, paths()).label}`);
						if (override !== false) play(ctx, next, state);
						return;
					}
					case "reset": {
						const target = rest[0] ?? "all";
						if (target === "all") {
							write({ ...config, sounds: {} });
							return say("All states use theme sounds again");
						}
						if (!isAlertState(target)) return say(`Unknown state "${target}"`, "warning");
						const sounds = { ...config.sounds };
						delete sounds[target];
						write({ ...config, sounds });
						return say(`${target} uses the theme sound again`);
					}
					case "volume": {
						const raw = rest[0];
						const percent = raw === undefined ? Number.NaN : Number(raw.replace(/%$/, ""));
						if (!Number.isFinite(percent)) {
							return say(`Volume is ${Math.round(config.volume * 100)}%. Usage: /sounds volume <0-100>`);
						}
						const next = { ...config, volume: clampVolume(percent / 100) };
						write(next);
						say(`Volume set to ${Math.round(next.volume * 100)}%`);
						play(ctx, next, "done");
						return;
					}
					case "on":
					case "off": {
						write({ ...config, enabled: command === "on" });
						return say(`Sound alerts ${command}`);
					}
					case "status":
						return say(describeConfig(config, paths(), file()));
					case "help":
						return usage();
					default:
						return usage();
				}
			},
		});
	};
}

export default createSoundAlerts();
