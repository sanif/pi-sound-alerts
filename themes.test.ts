import { describe, expect, test } from "bun:test";
import { SAMPLE_RATE } from "./synth";
import { ALERT_STATES, DEFAULT_THEME, findTheme, THEMES } from "./themes";

describe("themes", () => {
	test("ids are unique and the default exists", () => {
		const ids = THEMES.map((theme) => theme.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(findTheme(DEFAULT_THEME)).toBeDefined();
		expect(findTheme(" Gags ")?.id).toBe("gags");
		expect(findTheme("reels")?.id).toBe("gags");
		expect(THEMES[0]!.id).toBe(DEFAULT_THEME);
		expect(findTheme("nope")).toBeUndefined();
	});

	for (const theme of THEMES) {
		for (const state of ALERT_STATES) {
			test(`${theme.id}/${state} renders a short, audible, clean sound`, () => {
				expect(theme.labels[state].length).toBeGreaterThan(0);
				const samples = theme.render[state]();
				const seconds = samples.length / SAMPLE_RATE;
				expect(seconds).toBeGreaterThan(0.15);
				expect(seconds).toBeLessThan(4);
				let peak = 0;
				for (const sample of samples) {
					expect(Number.isFinite(sample)).toBe(true);
					peak = Math.max(peak, Math.abs(sample));
				}
				expect(peak).toBeGreaterThan(0.2);
				expect(peak).toBeLessThanOrEqual(0.9);
			});
		}
	}

	test("rendering is deterministic", () => {
		const theme = findTheme("gags")!;
		expect(theme.render.done()).toEqual(theme.render.done());
	});
});
