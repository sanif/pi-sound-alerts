import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, loadConfig, parseConfig, resolveSoundPath, saveConfig, themeReference } from "./config";

const temps: string[] = [];
const temp = () => {
	const directory = mkdtempSync(join(tmpdir(), "psa-config-"));
	temps.push(directory);
	return directory;
};
afterEach(() => {
	for (const directory of temps.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("config", () => {
	test("missing file gives defaults without warnings", () => {
		expect(loadConfig(join(temp(), "none.json"))).toEqual({ config: DEFAULT_CONFIG, warnings: [] });
	});

	test("keeps valid fields and reports invalid ones", () => {
		const { config, warnings } = parseConfig({
			theme: "HYPE",
			volume: 3,
			enabled: "yes",
			modes: ["tui", "rpc"],
			sounds: { done: "~/faah.mp3", question: false, error: "theme:zen", aborted: "theme:nope", bogus: "x" },
		});
		expect(config.theme).toBe("hype");
		expect(config.volume).toBe(1);
		expect(config.enabled).toBe(true);
		expect(config.modes).toEqual(["tui", "rpc"]);
		expect(config.sounds).toEqual({ done: "~/faah.mp3", question: false, error: "theme:zen" });
		expect(warnings).toHaveLength(3);
	});

	test("unknown theme falls back with a warning", () => {
		const { config, warnings } = parseConfig({ theme: "loud" });
		expect(config.theme).toBe(DEFAULT_CONFIG.theme);
		expect(warnings[0]).toContain("Unknown theme");
	});

	test("invalid JSON falls back to defaults", () => {
		const file = join(temp(), "bad.json");
		writeFileSync(file, "{nope");
		const loaded = loadConfig(file);
		expect(loaded.config).toEqual(DEFAULT_CONFIG);
		expect(loaded.warnings[0]).toContain("not valid JSON");
	});

	test("save and load round-trip", () => {
		const file = join(temp(), "nested", "pi-sound-alerts.json");
		const config = { ...DEFAULT_CONFIG, theme: "zen", volume: 0.4, sounds: { done: false as const } };
		saveConfig(file, config);
		expect(loadConfig(file)).toEqual({ config, warnings: [] });
	});

	test("resolves home, relative, and absolute paths", () => {
		expect(resolveSoundPath("~/a.mp3", "/cfg", "/home/me")).toBe("/home/me/a.mp3");
		expect(resolveSoundPath("sounds/a.mp3", "/cfg", "/home/me")).toBe("/cfg/sounds/a.mp3");
		expect(resolveSoundPath("/x/a.mp3", "/cfg", "/home/me")).toBe("/x/a.mp3");
	});

	test("recognises theme references", () => {
		expect(themeReference("theme:Arcade")).toBe("arcade");
		expect(themeReference("./theme.mp3")).toBeUndefined();
	});
});
