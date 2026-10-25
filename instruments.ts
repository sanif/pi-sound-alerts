import {
	type Curve,
	type Formant,
	constant,
	filter,
	formantGain,
	glide,
	mix,
	noise,
	shape,
	sine,
	tone,
} from "./synth";

/** Formant sets for a shouting adult voice. */
export const VOWELS = {
	aa: [
		{ f: 760, bw: 90, g: 1 },
		{ f: 1150, bw: 110, g: 0.55 },
		{ f: 2500, bw: 160, g: 0.28 },
		{ f: 3450, bw: 250, g: 0.12 },
	],
	uh: [
		{ f: 640, bw: 80, g: 1 },
		{ f: 1190, bw: 100, g: 0.5 },
		{ f: 2390, bw: 150, g: 0.22 },
		{ f: 3300, bw: 250, g: 0.1 },
	],
	r: [
		{ f: 440, bw: 90, g: 1 },
		{ f: 1050, bw: 120, g: 0.45 },
		{ f: 1550, bw: 140, g: 0.35 },
		{ f: 3100, bw: 250, g: 0.08 },
	],
	closed: [
		{ f: 380, bw: 100, g: 1 },
		{ f: 900, bw: 140, g: 0.3 },
		{ f: 2300, bw: 200, g: 0.1 },
		{ f: 3300, bw: 300, g: 0.05 },
	],
} satisfies Record<string, Formant[]>;

export interface VoiceSpec {
	duration: number;
	f0: Curve;
	amp: Curve;
	formants: (t: number) => Formant[];
	vibrato?: { rate: number; depth: Curve };
	/** Aspiration noise level relative to the voiced amplitude. */
	breath?: Curve;
	/** Spectral tilt exponent: lower is brighter, like shouting. */
	tilt?: number;
	seed: number;
}

/** Formant voice: a harmonic source shaped by moving vocal resonances. */
export function voice(spec: VoiceSpec): Float32Array {
	const tilt = spec.tilt ?? 1;
	const voiced = tone({
		duration: spec.duration,
		f0: spec.f0,
		amp: spec.amp,
		vibrato: spec.vibrato,
		wander: 0.012,
		maxFreq: 6500,
		seed: spec.seed,
		spectrum: (freq, k, t) => formantGain(spec.formants(t), freq) / k ** tilt,
	});
	if (!spec.breath) return voiced;
	const breath = spec.breath;
	const raw = noise(spec.duration, spec.seed + 7);
	const parts = [0, 1, 2].map((index) =>
		filter(
			raw,
			"bandpass",
			(t) => spec.formants(t)[index]?.f ?? 1000,
			(t) => {
				const formant = spec.formants(t)[index];
				return formant ? formant.f / (formant.bw * 1.6) : 1;
			},
		),
	);
	const aspiration = mix(
		{ buffer: parts[0]!, gain: 1 },
		{ buffer: parts[1]!, gain: 0.7 },
		{ buffer: parts[2]!, gain: 0.4 },
	);
	shape(aspiration, (t) => breath(t) * Math.max(spec.amp(t), 0.25) * 0.9);
	return mix({ buffer: voiced }, { buffer: aspiration });
}

/** Fricative hiss for consonants such as "f", "s", or "h". */
export function hiss(
	duration: number,
	options: { low: number; center: number; q: number; amp: Curve; seed: number },
): Float32Array {
	const raw = noise(duration, options.seed);
	const bright = filter(filter(raw, "highpass", options.low), "bandpass", options.center, options.q);
	return shape(mix({ buffer: bright }, { buffer: filter(raw, "highpass", options.low), gain: 0.35 }), options.amp);
}

export interface Note {
	/** Frequency in Hz. */
	f: number;
	/** Start in seconds. */
	at: number;
	/** Length in seconds. */
	len: number;
	/** Peak level, default 1. */
	level?: number;
}

/** Note name such as "A4" or "C#5" to Hz. */
export function hz(name: string): number {
	const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
	if (!match) throw new Error(`Invalid note ${name}`);
	const steps: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
	let semitone = steps[match[1]!]! + (Number(match[3]) - 4) * 12;
	if (match[2] === "#") semitone += 1;
	if (match[2] === "b") semitone -= 1;
	return 440 * 2 ** (semitone / 12);
}

/** Pitch curve that steps between notes with a short glide. */
export function melody(notes: readonly Note[], portamento = 0.02): Curve {
	const points: Array<[number, number]> = [];
	for (const note of notes) {
		points.push([note.at, note.f], [note.at + note.len - portamento, note.f]);
	}
	return glide(points);
}

/** Amplitude envelope for a sequence of articulated notes. */
export function articulate(
	notes: readonly Note[],
	options: { attack: number; release: number; sustain?: number },
): Curve {
	const sustain = options.sustain ?? 0.85;
	return (t) => {
		let level = 0;
		for (const note of notes) {
			const local = t - note.at;
			if (local < 0 || local > note.len + options.release) continue;
			const peak = note.level ?? 1;
			let value: number;
			if (local < options.attack) value = (local / options.attack) * peak;
			else if (local < note.len) {
				const progress = (local - options.attack) / Math.max(note.len - options.attack, 1e-3);
				value = peak * (1 - (1 - sustain) * progress);
			} else value = peak * sustain * (1 - (local - note.len) / options.release);
			level = Math.max(level, value);
		}
		return level;
	};
}

/** Brass-like tone whose brightness follows loudness, with an optional mute "wah". */
export function brass(options: {
	duration: number;
	f0: Curve;
	amp: Curve;
	wah?: Curve;
	vibrato?: { rate: number; depth: Curve };
	seed: number;
}): Float32Array {
	return tone({
		duration: options.duration,
		f0: options.f0,
		amp: options.amp,
		vibrato: options.vibrato,
		wander: 0.003,
		seed: options.seed,
		maxFreq: 7000,
		spectrum: (freq, k, t) => {
			const brightness = 1.5 + 6 * options.amp(t);
			let value = Math.exp(-(k - 1) / brightness);
			if (options.wah) {
				const center = options.wah(t);
				const x = (freq - center) / (center * 0.55);
				value *= 0.25 + 1.4 / (1 + x * x);
			}
			return value;
		},
	});
}

/** Band-limited chiptune pulse wave. */
export function chip(options: {
	duration: number;
	f0: Curve;
	amp: Curve;
	duty?: number;
	vibrato?: { rate: number; depth: Curve };
}): Float32Array {
	const duty = options.duty ?? 0.5;
	return tone({
		duration: options.duration,
		f0: options.f0,
		amp: options.amp,
		vibrato: options.vibrato,
		maxFreq: 11_000,
		spectrum: (_freq, k) => Math.abs(Math.sin(Math.PI * k * duty)) / k,
	});
}

/** Struck metal: inharmonic partials with individual decays. */
export function bell(options: {
	f: number;
	duration: number;
	partials: ReadonlyArray<readonly [ratio: number, level: number, decay: number]>;
	attack?: number;
	level?: number;
}): Float32Array {
	const attack = options.attack ?? 0.002;
	const parts = options.partials.map(([ratio, level, decay]) =>
		sine(
			options.duration,
			constant(options.f * ratio),
			(t) => (options.level ?? 1) * level * Math.min(t / attack, 1) * Math.exp(-t / decay),
		),
	);
	return mix(...parts.map((buffer) => ({ buffer })));
}

/** Short percussive transient such as a click or thump. */
export function click(options: {
	duration: number;
	center: number;
	q: number;
	decay: number;
	seed: number;
}): Float32Array {
	const raw = filter(noise(options.duration, options.seed), "bandpass", options.center, options.q);
	return shape(raw, (t) => Math.exp(-t / options.decay));
}
