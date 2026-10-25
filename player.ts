import { type ChildProcess, spawn as nodeSpawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { delimiter, extname, join } from "node:path";
import { encodeWav } from "./synth";
import type { AlertState, Theme } from "./themes";

/** Bump when any recipe changes so cached renders are replaced. */
export const RENDER_VERSION = 1;

export interface PlayCommand {
	command: string;
	args: string[];
}

export type Which = (binary: string) => boolean;

/** Look up executables on PATH once per binary. */
export function pathWhich(path = process.env.PATH ?? ""): Which {
	const cache = new Map<string, boolean>();
	return (binary) => {
		let found = cache.get(binary);
		if (found === undefined) {
			found = path.split(delimiter).some((directory) => {
				if (!directory) return false;
				try {
					accessSync(join(directory, binary), constants.X_OK);
					return true;
				} catch {
					return false;
				}
			});
			cache.set(binary, found);
		}
		return found;
	};
}

/** Choose a command-line audio player for this platform and file type. */
export function playerCommand(
	file: string,
	volume: number,
	platform: NodeJS.Platform,
	which: Which,
): PlayCommand | undefined {
	const percent = String(Math.round(volume * 100));
	if (platform === "darwin") {
		return { command: "afplay", args: ["-v", volume.toFixed(2), file] };
	}
	const isWav = extname(file).toLowerCase() === ".wav";
	const players: PlayCommand[] = [
		{ command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", percent, file] },
		{ command: "mpv", args: ["--no-video", "--really-quiet", `--volume=${percent}`, file] },
		{ command: "pw-play", args: [`--volume=${volume.toFixed(2)}`, file] },
		{ command: "paplay", args: [`--volume=${Math.round(volume * 65_536)}`, file] },
	];
	if (isWav) {
		// Lightweight system players handle WAV reliably; prefer them over ffplay.
		players.push(players.shift()!, players.shift()!);
		players.push({ command: "aplay", args: ["-q", file] });
	}
	return players.find((player) => which(player.command));
}

export type Spawn = (command: string, args: string[]) => ChildProcess;

const defaultSpawn: Spawn = (command, args) =>
	nodeSpawn(command, args, { detached: true, stdio: "ignore" });

/** Plays one sound at a time; a new sound interrupts the previous one. */
export class Player {
	private current: ChildProcess | undefined;
	private readonly platform: NodeJS.Platform;
	private readonly which: Which;
	private readonly spawn: Spawn;

	constructor(options: { platform?: NodeJS.Platform; which?: Which; spawn?: Spawn } = {}) {
		this.platform = options.platform ?? process.platform;
		this.which = options.which ?? pathWhich();
		this.spawn = options.spawn ?? defaultSpawn;
	}

	/** Returns the player used, or undefined when no player is installed. */
	play(file: string, volume: number): string | undefined {
		const command = playerCommand(file, volume, this.platform, this.which);
		if (!command) return undefined;
		this.stop();
		const child = this.spawn(command.command, command.args);
		child.on("error", () => {});
		child.on("exit", () => {
			if (this.current === child) this.current = undefined;
		});
		child.unref();
		this.current = child;
		return command.command;
	}

	stop(): void {
		const child = this.current;
		this.current = undefined;
		if (child && child.exitCode === null && !child.killed) {
			try {
				child.kill();
			} catch {
				// Already gone.
			}
		}
	}
}

/** Render a theme sound to the cache on first use and return its path. */
export function themeSoundFile(theme: Theme, state: AlertState, cacheDir: string): string {
	const directory = join(cacheDir, `v${RENDER_VERSION}`);
	const file = join(directory, `${theme.id}-${state}.wav`);
	if (!existsSync(file)) {
		mkdirSync(directory, { recursive: true });
		const temporary = `${file}.${process.pid}.tmp`;
		writeFileSync(temporary, encodeWav(theme.render[state]()));
		renameSync(temporary, file);
	}
	return file;
}
