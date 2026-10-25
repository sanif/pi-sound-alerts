import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_FILE } from "./config";
import { createSoundAlerts } from "./index";
import { Player } from "./player";

class FakePlayer extends Player {
	played: Array<{ file: string; volume: number }> = [];
	override play(file: string, volume: number): string {
		this.played.push({ file, volume });
		return "fake";
	}
	names() {
		return this.played.map((entry) => basename(entry.file));
	}
}

type Handler = (event: unknown, ctx: unknown) => unknown;

function setup(mode = "tui") {
	const agentDir = mkdtempSync(join(tmpdir(), "psa-agent-"));
	const player = new FakePlayer();
	const handlers = new Map<string, Handler[]>();
	let command: { handler: (args: string, ctx: unknown) => Promise<void>; getArgumentCompletions?: (prefix: string) => unknown } | undefined;
	const pi = {
		on(event: string, handler: Handler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
			return () => {};
		},
		registerCommand(name: string, options: typeof command) {
			expect(name).toBe("sounds");
			command = options;
		},
	} as unknown as ExtensionAPI;
	createSoundAlerts({ agentDir, player, sleep: async () => {} })(pi);
	const notes: Array<{ message: string; level?: string }> = [];
	const ctx = { mode, hasUI: true, ui: { notify: (message: string, level?: string) => notes.push({ message, level }) } };
	const emit = async (event: string, payload: Record<string, unknown> = {}) => {
		for (const handler of handlers.get(event) ?? []) await handler({ type: event, ...payload }, ctx);
	};
	const run = (args: string) => command!.handler(args, ctx);
	const config = () => JSON.parse(readFileSync(join(agentDir, CONFIG_FILE), "utf8"));
	return { agentDir, player, emit, run, notes, config, command: () => command! };
}

let current: ReturnType<typeof setup> | undefined;
const temps: string[] = [];
beforeEach(() => {
	delete process.env.PI_SOUND_ALERTS;
});
afterEach(() => {
	if (current) temps.push(current.agentDir);
	current = undefined;
	for (const directory of temps.splice(0)) rmSync(directory, { recursive: true, force: true });
	delete process.env.PI_SOUND_ALERTS;
});

function use(mode?: string) {
	current = setup(mode);
	return current;
}

describe("alerts", () => {
	test("plays done, error, and aborted when a run settles", async () => {
		const { emit, player } = use();
		await emit("agent_start");
		await emit("agent_before_settle", { outcome: "completed" });
		await emit("agent_settled", { aborted: false });
		await emit("agent_start");
		await emit("agent_before_settle", { outcome: "error" });
		await emit("agent_settled", { aborted: false });
		await emit("agent_start");
		await emit("agent_settled", { aborted: true });
		expect(player.names()).toEqual(["minimal-done.wav", "minimal-error.wav", "minimal-aborted.wav"]);
		expect(player.played[0]!.volume).toBe(0.7);
	});

	test("plays question only for prompts during a run", async () => {
		const { emit, player } = use();
		await emit("ui_prompt_start", { kind: "select" });
		await emit("agent_start");
		await emit("ui_prompt_start", { kind: "select" });
		expect(player.names()).toEqual(["minimal-question.wav"]);
	});

	test("stays quiet outside configured modes, when off, or via env", async () => {
		const json = use("json");
		await json.emit("agent_settled", { aborted: false });
		expect(json.player.played).toHaveLength(0);
		temps.push(json.agentDir);

		const tui = use();
		await tui.run("off");
		await tui.emit("agent_settled", { aborted: false });
		await tui.run("on");
		process.env.PI_SOUND_ALERTS = "0";
		await tui.emit("agent_settled", { aborted: false });
		expect(tui.player.played).toHaveLength(0);
	});

	test("uses custom files, borrowed theme sounds, and mutes", async () => {
		const { agentDir, emit, run, player, config } = use();
		const custom = join(agentDir, "my faah.mp3");
		writeFileSync(custom, "fake");
		await run(`set done ${custom}`);
		await run("set error theme:arcade");
		await run("set aborted off");
		expect(config().sounds).toEqual({ done: custom, error: "theme:arcade", aborted: false });
		player.played = [];
		await emit("agent_settled", { aborted: false });
		await emit("agent_before_settle", { outcome: "error" });
		await emit("agent_settled", { aborted: false });
		await emit("agent_settled", { aborted: true });
		expect(player.played.map((entry) => entry.file)).toEqual([custom, expect.stringContaining("arcade-error.wav")]);
	});

	test("falls back to the theme sound when a custom file disappears", async () => {
		const { agentDir, emit, player, notes } = use();
		writeFileSync(join(agentDir, CONFIG_FILE), JSON.stringify({ sounds: { done: "gone.mp3" } }));
		await emit("agent_settled", { aborted: false });
		await emit("agent_settled", { aborted: false });
		expect(player.names()).toEqual(["minimal-done.wav", "minimal-done.wav"]);
		expect(notes.filter((note) => note.message.includes("not found"))).toHaveLength(1);
	});
});

describe("/sounds", () => {
	test("sets theme and volume", async () => {
		const { run, config, emit, player } = use();
		await run("theme arcade");
		await run("volume 35");
		expect(config()).toMatchObject({ theme: "arcade", volume: 0.35 });
		player.played = [];
		await emit("agent_settled", { aborted: false });
		expect(player.played).toEqual([{ file: expect.stringContaining("arcade-done.wav"), volume: 0.35 }]);
	});

	test("rejects unknown themes and missing files without writing", async () => {
		const { run, notes, agentDir } = use();
		await run("theme loud");
		await run("set done /nope/x.mp3");
		expect(notes.map((note) => note.level)).toEqual(["warning", "warning"]);
		expect(() => readFileSync(join(agentDir, CONFIG_FILE))).toThrow();
	});

	test("previews every state of a theme", async () => {
		const { run, player } = use();
		await run("preview zen");
		expect(player.names()).toEqual(["zen-done.wav", "zen-question.wav", "zen-error.wav", "zen-aborted.wav"]);
	});

	test("reset restores theme sounds", async () => {
		const { run, config } = use();
		await run("set done off");
		await run("set error off");
		await run("reset done");
		expect(config().sounds).toEqual({ error: false });
		await run("reset");
		expect(config().sounds).toEqual({});
	});

	test("completes subcommands, themes, and states", () => {
		const complete = use().command().getArgumentCompletions!;
		expect(complete("th")).toEqual([expect.objectContaining({ value: "theme" })]);
		expect(complete("theme a")).toEqual([expect.objectContaining({ value: "theme arcade" })]);
		expect(complete("set q")).toEqual([expect.objectContaining({ value: "set question" })]);
		expect(complete("set done theme:h")).toEqual([expect.objectContaining({ value: "set done theme:hype" })]);
	});
});
