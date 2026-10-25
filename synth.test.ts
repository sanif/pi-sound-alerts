import { describe, expect, test } from "bun:test";
import { curve, encodeWav, finish, glide, mix, noise, SAMPLE_RATE, silence } from "./synth";

describe("synth", () => {
	test("curves interpolate and clamp at the ends", () => {
		const line = curve([
			[0, 0],
			[1, 10],
		]);
		expect(line(-1)).toBe(0);
		expect(line(0.5)).toBe(5);
		expect(line(2)).toBe(10);
		const pitch = glide([
			[0, 100],
			[1, 400],
		]);
		expect(pitch(0.5)).toBeCloseTo(200, 6);
	});

	test("noise is deterministic per seed", () => {
		expect(noise(0.01, 3)).toEqual(noise(0.01, 3));
		expect(noise(0.01, 3)).not.toEqual(noise(0.01, 4));
	});

	test("mix offsets parts in time", () => {
		const one = new Float32Array([1, 1]);
		const out = mix({ buffer: one }, { at: 1 / SAMPLE_RATE, buffer: one, gain: 0.5 });
		expect([...out]).toEqual([1, 1.5, 0.5]);
	});

	test("finish trims silence and respects the peak", () => {
		const input = mix({ buffer: noise(0.1, 1), gain: 0.01 }, { buffer: silence(0.5) });
		const out = finish(input, 0.5);
		expect(out.length).toBeLessThan(input.length);
		expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.5 + 1e-6);
	});

	test("encodes a mono 16-bit PCM WAV", () => {
		const bytes = encodeWav(new Float32Array([0, 1, -1, 2]));
		const view = new DataView(bytes.buffer);
		expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
		expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
		expect(view.getUint16(22, true)).toBe(1);
		expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
		expect(view.getUint32(40, true)).toBe(8);
		expect(view.getInt16(46, true)).toBe(32_767);
		expect(view.getInt16(48, true)).toBe(-32_767);
		expect(view.getInt16(50, true)).toBe(32_767);
	});
});
