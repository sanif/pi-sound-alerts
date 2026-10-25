import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { ALERT_STATES, type AlertState, DEFAULT_THEME, findTheme } from "./themes";

export const CONFIG_FILE = "pi-sound-alerts.json";

export type AlertMode = "tui" | "rpc" | "json" | "print";
const MODES: readonly AlertMode[] = ["tui", "rpc", "json", "print"];

/**
 * Per-state sound choice:
 * - a file path (`~/sounds/faah.mp3`, absolute, or relative to the config file);
 * - `"theme:<id>"` to borrow one state's sound from another theme;
 * - `false` to mute that state.
 */
export type SoundOverride = string | false;

export interface SoundConfig {
	enabled: boolean;
	theme: string;
	/** Playback volume from 0 to 1. */
	volume: number;
	/** Pi modes that play sounds. Subagents and scripts usually run in json or print mode. */
	modes: AlertMode[];
	sounds: Partial<Record<AlertState, SoundOverride>>;
}

export const DEFAULT_CONFIG: SoundConfig = {
	enabled: true,
	theme: DEFAULT_THEME,
	volume: 0.7,
	modes: ["tui"],
	sounds: {},
};

export interface LoadedConfig {
	config: SoundConfig;
	warnings: string[];
}

export function configPath(agentDir: string): string {
	return join(agentDir, CONFIG_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAlertState(value: string): value is AlertState {
	return (ALERT_STATES as readonly string[]).includes(value);
}

export function clampVolume(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Validate untrusted JSON, keeping every valid field and reporting the rest. */
export function parseConfig(raw: unknown): LoadedConfig {
	const config: SoundConfig = { ...DEFAULT_CONFIG, modes: [...DEFAULT_CONFIG.modes], sounds: {} };
	const warnings: string[] = [];
	if (!isRecord(raw)) {
		return { config, warnings: ["Config must be a JSON object; using defaults"] };
	}
	if ("enabled" in raw) {
		if (typeof raw.enabled === "boolean") config.enabled = raw.enabled;
		else warnings.push("`enabled` must be true or false");
	}
	if ("theme" in raw) {
		const theme = typeof raw.theme === "string" ? findTheme(raw.theme) : undefined;
		if (theme) config.theme = theme.id;
		else warnings.push(`Unknown theme ${JSON.stringify(raw.theme)}; using ${DEFAULT_THEME}`);
	}
	if ("volume" in raw) {
		if (typeof raw.volume === "number" && Number.isFinite(raw.volume)) config.volume = clampVolume(raw.volume);
		else warnings.push("`volume` must be a number from 0 to 1");
	}
	if ("modes" in raw) {
		if (Array.isArray(raw.modes) && raw.modes.every((mode) => MODES.includes(mode as AlertMode))) {
			config.modes = [...new Set(raw.modes as AlertMode[])];
		} else warnings.push(`\`modes\` must list any of ${MODES.join(", ")}`);
	}
	if ("sounds" in raw) {
		if (isRecord(raw.sounds)) {
			for (const [state, value] of Object.entries(raw.sounds)) {
				if (!isAlertState(state)) {
					warnings.push(`Unknown state ${JSON.stringify(state)} in \`sounds\``);
				} else if (value === false || (typeof value === "string" && value.trim())) {
					const problem = typeof value === "string" ? overrideProblem(value) : undefined;
					if (problem) warnings.push(`sounds.${state}: ${problem}`);
					else config.sounds[state] = typeof value === "string" ? value.trim() : false;
				} else if (value !== null && value !== undefined) {
					warnings.push(`sounds.${state} must be a file path, "theme:<id>", or false`);
				}
			}
		} else warnings.push("`sounds` must be an object");
	}
	return { config, warnings };
}

function overrideProblem(value: string): string | undefined {
	const borrowed = themeReference(value);
	if (borrowed === undefined) return undefined;
	return findTheme(borrowed) ? undefined : `unknown theme ${JSON.stringify(borrowed)}`;
}

/** Theme id from a `"theme:<id>"` override, or undefined for file paths. */
export function themeReference(value: string): string | undefined {
	const match = /^theme:(.+)$/i.exec(value.trim());
	return match ? match[1]!.trim().toLowerCase() : undefined;
}

export function loadConfig(path: string): LoadedConfig {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { config: parseConfig({}).config, warnings: [] };
		}
		return { config: parseConfig({}).config, warnings: [`Could not read ${path}: ${(error as Error).message}`] };
	}
	try {
		return parseConfig(JSON.parse(text));
	} catch {
		return { config: parseConfig({}).config, warnings: [`${path} is not valid JSON; using defaults`] };
	}
}

/** Write the config atomically so a crash never leaves a truncated file. */
export function saveConfig(path: string, config: SoundConfig): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(config, null, "\t")}\n`, "utf8");
	renameSync(temporary, path);
}

/** Expand `~` and resolve relative paths against the config directory. */
export function resolveSoundPath(value: string, configDir: string, home = homedir()): string {
	const trimmed = value.trim();
	if (trimmed === "~") return home;
	if (trimmed.startsWith("~/")) return join(home, trimmed.slice(2));
	return isAbsolute(trimmed) ? trimmed : resolve(configDir, trimmed);
}
