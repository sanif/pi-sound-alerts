/**
 * Tiny deterministic audio synthesizer.
 *
 * Every bundled sound is generated from code at runtime, so the package ships
 * no third-party recordings. All randomness is seeded, so a recipe always
 * renders the same samples.
 */

export const SAMPLE_RATE = 44_100;

/** A value that changes over time, in seconds from the start of a sound. */
export type Curve = (t: number) => number;

export interface Formant {
	/** Center frequency in Hz. */
	f: number;
	/** Bandwidth in Hz. */
	bw: number;
	/** Linear gain. */
	g: number;
}

export function seconds(samples: number): number {
	return samples / SAMPLE_RATE;
}

export function samplesFor(duration: number): number {
	return Math.max(0, Math.round(duration * SAMPLE_RATE));
}

export function silence(duration: number): Float32Array {
	return new Float32Array(samplesFor(duration));
}

/** Seeded PRNG (mulberry32) returning values in [0, 1). */
export function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** Piecewise-linear curve through `[time, value]` points. */
export function curve(points: ReadonlyArray<readonly [number, number]>): Curve {
	if (points.length === 0) return () => 0;
	const sorted = [...points].sort((a, b) => a[0] - b[0]);
	return (t) => {
		const first = sorted[0]!;
		if (t <= first[0]) return first[1];
		for (let index = 1; index < sorted.length; index += 1) {
			const [t1, v1] = sorted[index]!;
			if (t <= t1) {
				const [t0, v0] = sorted[index - 1]!;
				const span = t1 - t0;
				return span <= 0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / span;
			}
		}
		return sorted[sorted.length - 1]![1];
	};
}

/** Curve that interpolates geometrically, which suits pitch glides. */
export function glide(points: ReadonlyArray<readonly [number, number]>): Curve {
	const log = curve(points.map(([t, v]) => [t, Math.log(v)] as const));
	return (t) => Math.exp(log(t));
}

export function constant(value: number): Curve {
	return () => value;
}

/** Interpolate between formant sets, e.g. for a consonant-to-vowel move. */
export function formantPath(
	points: ReadonlyArray<readonly [number, readonly Formant[]]>,
): (t: number) => Formant[] {
	const count = Math.max(...points.map(([, set]) => set.length));
	const tracks = Array.from({ length: count }, (_, index) => ({
		f: curve(points.map(([t, set]) => [t, set[index]?.f ?? 3000] as const)),
		bw: curve(points.map(([t, set]) => [t, set[index]?.bw ?? 200] as const)),
		g: curve(points.map(([t, set]) => [t, set[index]?.g ?? 0] as const)),
	}));
	return (t) => tracks.map((track) => ({ f: track.f(t), bw: track.bw(t), g: track.g(t) }));
}

/** Sum of resonance peaks evaluated at one frequency. */
export function formantGain(formants: readonly Formant[], freq: number): number {
	let gain = 0;
	for (const formant of formants) {
		const x = (freq - formant.f) / (formant.bw / 2);
		gain += formant.g / (1 + x * x);
	}
	return gain;
}

export interface ToneSpec {
	duration: number;
	/** Fundamental frequency over time. */
	f0: Curve;
	/** Amplitude envelope over time. */
	amp: Curve;
	/** Harmonic amplitude for harmonic `k` at frequency `freq` and time `t`. */
	spectrum: (freq: number, k: number, t: number) => number;
	vibrato?: { rate: number; depth: Curve };
	/** Slow random pitch wander as a fraction of f0, for natural voices. */
	wander?: number;
	maxFreq?: number;
	seed?: number;
	/** Starting phase in radians; offset detuned voices so they do not spike together. */
	phase?: number;
}

const BLOCK = 32;

/** Additive oscillator; spectra are re-evaluated every 32 samples. */
export function tone(spec: ToneSpec): Float32Array {
	const length = samplesFor(spec.duration);
	const out = new Float32Array(length);
	const maxFreq = Math.min(spec.maxFreq ?? 9000, SAMPLE_RATE / 2 - 500);
	const next = random(spec.seed ?? 1);
	let phase = spec.phase ?? 0;
	let wander = 0;
	let wanderTarget = 0;
	let amplitudes: number[] = [];
	for (let i = 0; i < length; i += 1) {
		const t = seconds(i);
		let freq = spec.f0(t);
		if (spec.vibrato) {
			freq *= 1 + spec.vibrato.depth(t) * Math.sin(2 * Math.PI * spec.vibrato.rate * t);
		}
		if (spec.wander) {
			if (i % 2205 === 0) wanderTarget = (next() * 2 - 1) * spec.wander;
			wander += (wanderTarget - wander) * 0.0008;
			freq *= 1 + wander;
		}
		if (i % BLOCK === 0) {
			const harmonics = Math.max(1, Math.floor(maxFreq / Math.max(freq, 1)));
			amplitudes = [];
			for (let k = 1; k <= harmonics; k += 1) {
				amplitudes.push(spec.spectrum(freq * k, k, t));
			}
		}
		phase += (2 * Math.PI * freq) / SAMPLE_RATE;
		if (phase > 2 * Math.PI * 1e4) phase -= 2 * Math.PI * 1e4;
		let sample = 0;
		for (let k = 0; k < amplitudes.length; k += 1) {
			const amplitude = amplitudes[k]!;
			if (amplitude !== 0) sample += amplitude * Math.sin((k + 1) * phase);
		}
		out[i] = sample * spec.amp(t);
	}
	return out;
}

/** Plain sine with a pitch curve, cheaper than `tone` for pure partials. */
export function sine(duration: number, f0: Curve, amp: Curve): Float32Array {
	const length = samplesFor(duration);
	const out = new Float32Array(length);
	let phase = 0;
	for (let i = 0; i < length; i += 1) {
		const t = seconds(i);
		phase += (2 * Math.PI * f0(t)) / SAMPLE_RATE;
		out[i] = Math.sin(phase) * amp(t);
	}
	return out;
}

export function noise(duration: number, seed: number): Float32Array {
	const length = samplesFor(duration);
	const out = new Float32Array(length);
	const next = random(seed);
	for (let i = 0; i < length; i += 1) out[i] = next() * 2 - 1;
	return out;
}

export type FilterKind = "lowpass" | "highpass" | "bandpass";

/** RBJ cookbook biquad; parameters may change over time. */
export function filter(
	input: Float32Array,
	kind: FilterKind,
	freq: Curve | number,
	q: Curve | number = Math.SQRT1_2,
): Float32Array {
	const freqAt = typeof freq === "number" ? constant(freq) : freq;
	const qAt = typeof q === "number" ? constant(q) : q;
	const out = new Float32Array(input.length);
	let b0 = 0;
	let b1 = 0;
	let b2 = 0;
	let a1 = 0;
	let a2 = 0;
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	for (let i = 0; i < input.length; i += 1) {
		if (i % BLOCK === 0) {
			const t = seconds(i);
			const f = Math.min(Math.max(freqAt(t), 20), SAMPLE_RATE / 2 - 100);
			const w0 = (2 * Math.PI * f) / SAMPLE_RATE;
			const alpha = Math.sin(w0) / (2 * Math.max(qAt(t), 0.05));
			const cos = Math.cos(w0);
			const a0 = 1 + alpha;
			if (kind === "lowpass") {
				b0 = (1 - cos) / 2 / a0;
				b1 = (1 - cos) / a0;
				b2 = b0;
			} else if (kind === "highpass") {
				b0 = (1 + cos) / 2 / a0;
				b1 = -(1 + cos) / a0;
				b2 = b0;
			} else {
				b0 = alpha / a0;
				b1 = 0;
				b2 = -alpha / a0;
			}
			a1 = (-2 * cos) / a0;
			a2 = (1 - alpha) / a0;
		}
		const x = input[i]!;
		const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
		out[i] = y;
	}
	return out;
}

/** Multiply a buffer by an envelope in place and return it. */
export function shape(buffer: Float32Array, amp: Curve): Float32Array {
	for (let i = 0; i < buffer.length; i += 1) buffer[i]! *= amp(seconds(i));
	return buffer;
}

export function gain(buffer: Float32Array, amount: number): Float32Array {
	for (let i = 0; i < buffer.length; i += 1) buffer[i]! *= amount;
	return buffer;
}

/** Tanh saturation, normalized so full-scale input stays full scale. */
export function drive(buffer: Float32Array, amount: number): Float32Array {
	const norm = Math.tanh(amount);
	for (let i = 0; i < buffer.length; i += 1) {
		buffer[i] = Math.tanh(buffer[i]! * amount) / norm;
	}
	return buffer;
}

/** Mix `parts` into one buffer; each part starts at `at` seconds. */
export function mix(
	...parts: ReadonlyArray<{ at?: number; buffer: Float32Array; gain?: number }>
): Float32Array {
	let length = 0;
	for (const part of parts) {
		length = Math.max(length, samplesFor(part.at ?? 0) + part.buffer.length);
	}
	const out = new Float32Array(length);
	for (const part of parts) {
		const offset = samplesFor(part.at ?? 0);
		const amount = part.gain ?? 1;
		for (let i = 0; i < part.buffer.length; i += 1) {
			out[offset + i]! += part.buffer[i]! * amount;
		}
	}
	return out;
}

/** Schroeder reverb: parallel combs into series all-passes. */
export function reverb(
	input: Float32Array,
	options: { mix: number; decay?: number; tail?: number; damp?: number },
): Float32Array {
	const decay = options.decay ?? 0.78;
	const damp = options.damp ?? 0.3;
	const length = input.length + samplesFor(options.tail ?? 0.8);
	const wet = new Float32Array(length);
	for (const delay of [1557, 1617, 1491, 1422, 1277, 1356]) {
		const line = new Float32Array(delay);
		let index = 0;
		let low = 0;
		for (let i = 0; i < length; i += 1) {
			const delayed = line[index]!;
			low = delayed * (1 - damp) + low * damp;
			line[index] = (input[i] ?? 0) + low * decay;
			index = (index + 1) % delay;
			wet[i]! += delayed / 6;
		}
	}
	let out = wet;
	for (const delay of [225, 556, 441]) {
		const line = new Float32Array(delay);
		const next = new Float32Array(length);
		let index = 0;
		for (let i = 0; i < length; i += 1) {
			const delayed = line[index]!;
			const value = out[i]! + delayed * 0.5;
			line[index] = value;
			next[i] = delayed - value * 0.5;
			index = (index + 1) % delay;
		}
		out = next;
	}
	const result = new Float32Array(length);
	for (let i = 0; i < length; i += 1) {
		result[i] = (input[i] ?? 0) * (1 - options.mix) + out[i]! * options.mix;
	}
	return result;
}

/** Loudness ceiling so dense sounds are not much louder than sparse ones. */
const MAX_RMS = 0.17;

/** Trim trailing near-silence, fade the edges, and scale to `peak` within the loudness ceiling. */
export function finish(input: Float32Array, peak = 0.85): Float32Array {
	const buffer = removeDc(input);
	let max = 0;
	for (const sample of buffer) max = Math.max(max, Math.abs(sample));
	let end = buffer.length;
	while (end > 0 && Math.abs(buffer[end - 1]!) < max * 1e-3) end -= 1;
	const out = buffer.slice(0, Math.max(end, 1));
	let energy = 0;
	let active = 0;
	for (const sample of out) {
		if (Math.abs(sample) > max * 0.05) {
			energy += sample * sample;
			active += 1;
		}
	}
	const rms = active > 0 ? Math.sqrt(energy / active) : 0;
	let scale = max > 0 ? peak / max : 0;
	if (rms * scale > MAX_RMS) scale = MAX_RMS / rms;
	const fadeIn = Math.min(samplesFor(0.003), out.length);
	const fadeOut = Math.min(samplesFor(0.02), out.length);
	for (let i = 0; i < out.length; i += 1) {
		let edge = 1;
		if (i < fadeIn) edge = i / fadeIn;
		if (i >= out.length - fadeOut) edge = Math.min(edge, (out.length - 1 - i) / fadeOut);
		out[i] = out[i]! * scale * edge;
	}
	return out;
}

/** One-pole DC blocker (~10 Hz) so speakers never get a constant offset. */
export function removeDc(input: Float32Array): Float32Array {
	const out = new Float32Array(input.length);
	const r = 1 - (2 * Math.PI * 10) / SAMPLE_RATE;
	let x1 = 0;
	let y1 = 0;
	for (let i = 0; i < input.length; i += 1) {
		const x = input[i]!;
		const y = x - x1 + r * y1;
		x1 = x;
		y1 = y;
		out[i] = y;
	}
	return out;
}

/** Encode mono samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array): Uint8Array {
	const dataBytes = samples.length * 2;
	const bytes = new Uint8Array(44 + dataBytes);
	const view = new DataView(bytes.buffer);
	const text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
	};
	text(0, "RIFF");
	view.setUint32(4, 36 + dataBytes, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, SAMPLE_RATE, true);
	view.setUint32(28, SAMPLE_RATE * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, dataBytes, true);
	for (let i = 0; i < samples.length; i += 1) {
		const clamped = Math.max(-1, Math.min(1, samples[i]!));
		view.setInt16(44 + i * 2, Math.round(clamped * 32_767), true);
	}
	return bytes;
}
