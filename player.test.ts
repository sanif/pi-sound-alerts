import { afterEach, describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Player, playerCommand, RENDER_VERSION, themeSoundFile } from "./player";
import { findTheme } from "./themes";

const temps: string[] = [];
afterEach(() => {
	for (const directory of temps.splice(0)) rmSync(directory, { recursive: true, force: true });
});

class FakeChild extends EventEmitter {
	exitCode: number | null = null;
	killed = false;
	kill() {
		this.killed = true;
		return true;
	}
	unref() {}
}

describe("playerCommand", () => {
	test("uses afplay with volume on macOS", () => {
		expect(playerCommand("/a.mp3", 0.5, "darwin", () => false)).toEqual({
			command: "afplay",
			args: ["-v", "0.50", "/a.mp3"],
		});
	});

	test("prefers lightweight players for WAV on Linux", () => {
		const all = () => true;
		expect(playerCommand("/a.wav", 1, "linux", all)?.command).toBe("pw-play");
		expect(playerCommand("/a.wav", 1, "linux", (bin) => bin === "aplay")?.command).toBe("aplay");
	});

	test("prefers decoders for MP3 on Linux and never uses aplay", () => {
		expect(playerCommand("/a.mp3", 0.3, "linux", () => true)).toEqual({
			command: "ffplay",
			args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", "30", "/a.mp3"],
		});
		expect(playerCommand("/a.mp3", 1, "linux", (bin) => bin === "aplay")).toBeUndefined();
	});
});

describe("Player", () => {
	test("a new sound interrupts the previous one", () => {
		const children: FakeChild[] = [];
		const player = new Player({
			platform: "darwin",
			spawn: () => {
				const child = new FakeChild();
				children.push(child);
				return child as unknown as ChildProcess;
			},
		});
		expect(player.play("/a.wav", 1)).toBe("afplay");
		player.play("/b.wav", 1);
		expect(children[0]!.killed).toBe(true);
		expect(children[1]!.killed).toBe(false);
	});

	test("reports a missing player", () => {
		const player = new Player({ platform: "linux", which: () => false });
		expect(player.play("/a.wav", 1)).toBeUndefined();
	});
});

test("theme sounds render once into a versioned cache", () => {
	const cache = mkdtempSync(join(tmpdir(), "psa-cache-"));
	temps.push(cache);
	const file = themeSoundFile(findTheme("minimal")!, "done", cache);
	expect(file).toBe(join(cache, `v${RENDER_VERSION}`, "minimal-done.wav"));
	expect(existsSync(file)).toBe(true);
	const first = readFileSync(file);
	expect(themeSoundFile(findTheme("minimal")!, "done", cache)).toBe(file);
	expect(readFileSync(file)).toEqual(first);
});

test("a new render version removes stale cached renders", () => {
	const cache = mkdtempSync(join(tmpdir(), "psa-cache-"));
	temps.push(cache);
	mkdirSync(join(cache, "v0"), { recursive: true });
	themeSoundFile(findTheme("minimal")!, "done", cache);
	expect(existsSync(join(cache, "v0"))).toBe(false);
	expect(existsSync(join(cache, `v${RENDER_VERSION}`))).toBe(true);
});
