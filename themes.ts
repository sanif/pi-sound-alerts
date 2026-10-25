import {
	VOWELS,
	articulate,
	bell,
	brass,
	chip,
	click,
	hiss,
	hz,
	melody,
	voice,
	type Note,
} from "./instruments";
import {
	curve,
	drive,
	filter,
	finish,
	formantPath,
	gain,
	glide,
	mix,
	noise,
	reverb,
	shape,
	sine,
	tone,
} from "./synth";

export const ALERT_STATES = ["done", "question", "error", "aborted"] as const;
export type AlertState = (typeof ALERT_STATES)[number];

export const STATE_LABELS: Record<AlertState, string> = {
	done: "Agent finished",
	question: "Waiting for your answer",
	error: "Run ended with an error",
	aborted: "Run cancelled",
};

export interface Theme {
	id: string;
	name: string;
	description: string;
	/** Short name of each state's sound, shown in pickers. */
	labels: Record<AlertState, string>;
	render: Record<AlertState, () => Float32Array>;
}

// ---------------------------------------------------------------------------
// gags: original voice and gag sounds in the style of short-video memes.

function faah(): Float32Array {
	const start = 0.11;
	const length = 1.2;
	const fricative = hiss(0.22, {
		low: 1700,
		center: 4800,
		q: 0.9,
		amp: curve([
			[0, 0],
			[0.03, 0.55],
			[0.13, 0.7],
			[0.21, 0],
		]),
		seed: 11,
	});
	const vowel = voice({
		duration: length,
		seed: 12,
		tilt: 0.75,
		f0: glide([
			[0, 215],
			[0.07, 300],
			[0.22, 292],
			[0.65, 215],
			[1.15, 158],
		]),
		amp: curve([
			[0, 0],
			[0.05, 1],
			[0.35, 0.92],
			[0.85, 0.55],
			[1.18, 0],
		]),
		formants: formantPath([
			[0, VOWELS.closed],
			[0.07, VOWELS.aa],
			[0.9, VOWELS.aa],
			[1.2, VOWELS.uh],
		]),
		vibrato: {
			rate: 5.6,
			depth: curve([
				[0, 0],
				[0.35, 0.006],
				[1.1, 0.024],
			]),
		},
		breath: curve([
			[0, 0.3],
			[0.5, 0.18],
			[1.15, 0.65],
		]),
	});
	return finish(reverb(mix({ buffer: fricative, gain: 0.55 }, { at: start, buffer: vowel }), { mix: 0.14, tail: 0.5 }));
}

function huh(): Float32Array {
	const sound = voice({
		duration: 0.5,
		seed: 21,
		tilt: 0.9,
		f0: glide([
			[0, 128],
			[0.16, 142],
			[0.42, 300],
		]),
		amp: curve([
			[0, 0],
			[0.06, 0.08],
			[0.12, 1],
			[0.34, 0.9],
			[0.47, 0],
		]),
		formants: formantPath([
			[0, VOWELS.uh],
			[0.45, VOWELS.uh],
		]),
		breath: curve([
			[0, 3],
			[0.1, 1.2],
			[0.14, 0.15],
			[0.4, 0.3],
		]),
	});
	return finish(reverb(sound, { mix: 0.1, tail: 0.3 }));
}

function bruh(): Float32Array {
	const thump = sine(
		0.05,
		glide([
			[0, 120],
			[0.05, 70],
		]),
		(t) => Math.exp(-t / 0.012),
	);
	const burst = click({ duration: 0.03, center: 500, q: 0.8, decay: 0.006, seed: 31 });
	const vowel = voice({
		duration: 0.68,
		seed: 32,
		tilt: 1.05,
		f0: glide([
			[0, 118],
			[0.2, 106],
			[0.62, 80],
		]),
		amp: curve([
			[0, 0],
			[0.03, 0.6],
			[0.12, 1],
			[0.45, 0.8],
			[0.66, 0],
		]),
		formants: formantPath([
			[0, VOWELS.r],
			[0.09, VOWELS.r],
			[0.2, VOWELS.uh],
		]),
		breath: curve([
			[0, 0.1],
			[0.42, 0.15],
			[0.64, 0.9],
		]),
	});
	return finish(
		reverb(mix({ buffer: thump, gain: 0.25 }, { buffer: burst, gain: 0.12 }, { at: 0.015, buffer: vowel }), {
			mix: 0.08,
			tail: 0.3,
		}),
	);
}

function sadTrombone(): Float32Array {
	const notes: Note[] = [
		{ f: hz("D4"), at: 0, len: 0.27 },
		{ f: hz("C#4"), at: 0.3, len: 0.27 },
		{ f: hz("C4"), at: 0.6, len: 0.27 },
		{ f: hz("B3"), at: 0.9, len: 0.95 },
	];
	const amp = articulate(notes, { attack: 0.04, release: 0.08, sustain: 0.8 });
	const wah = (t: number) => {
		for (const note of notes) {
			const local = t - note.at;
			if (local >= 0 && local <= note.len + 0.08) {
				if (note.len > 0.5) return 450 + 700 * Math.min(local / 0.12, 1) * (1 - Math.max(local - 0.5, 0) / 0.5);
				return 450 + 650 * Math.min(local / 0.1, 1);
			}
		}
		return 450;
	};
	const horn = brass({
		duration: 1.95,
		f0: melody(notes, 0.04),
		amp,
		wah,
		vibrato: {
			rate: 5.2,
			depth: curve([
				[0, 0],
				[1.0, 0],
				[1.25, 0.03],
			]),
		},
		seed: 41,
	});
	return finish(reverb(horn, { mix: 0.12, tail: 0.5 }));
}

// ---------------------------------------------------------------------------
// hype: big gag sounds.

function airhorn(): Float32Array {
	const blasts: Note[] = [
		{ f: hz("A#4"), at: 0, len: 0.13 },
		{ f: hz("A#4"), at: 0.18, len: 0.13 },
		{ f: hz("A#4"), at: 0.36, len: 0.7 },
	];
	const amp = articulate(blasts, { attack: 0.012, release: 0.05, sustain: 0.92 });
	const pitch = (t: number) => {
		for (const blast of blasts) {
			const local = t - blast.at;
			if (local >= 0 && local < blast.len + 0.05) return blast.f * (0.94 + 0.06 * Math.min(local / 0.03, 1));
		}
		return blasts[0]!.f;
	};
	const horns = [1, 1.006, 1.26].map((ratio, index) =>
		tone({
			duration: 1.15,
			f0: (t) => pitch(t) * ratio,
			amp,
			maxFreq: 9000,
			seed: 51 + index,
			spectrum: (freq, k) => {
				const x = (freq - 2200) / 1600;
				return (0.4 + 1 / (1 + x * x)) / k ** 0.55;
			},
		}),
	);
	const body = mix({ buffer: horns[0]! }, { buffer: horns[1]!, gain: 0.8 }, { buffer: horns[2]!, gain: 0.45 });
	return finish(reverb(drive(filter(gain(body, 0.4), "highpass", 250), 2.4), { mix: 0.12, tail: 0.5 }));
}

function dramatic(): Float32Array {
	const notes: Note[] = [
		{ f: hz("E3"), at: 0, len: 0.18 },
		{ f: hz("F3"), at: 0.25, len: 0.18 },
		{ f: hz("D#3"), at: 0.5, len: 1.0 },
	];
	const amp = articulate(notes, { attack: 0.015, release: 0.15, sustain: 0.75 });
	const low = brass({ duration: 1.75, f0: melody(notes, 0.01), amp, seed: 61 });
	const high = brass({
		duration: 1.75,
		f0: (t) => melody(notes, 0.01)(t) * 2,
		amp,
		vibrato: {
			rate: 6.5,
			depth: curve([
				[0, 0],
				[0.7, 0],
				[0.9, 0.012],
			]),
		},
		seed: 62,
	});
	const hits = notes.map((note) => ({
		at: note.at,
		buffer: sine(
			0.4,
			glide([
				[0, 110],
				[0.3, 45],
			]),
			(t) => Math.exp(-t / 0.12),
		),
		gain: 0.9,
	}));
	return finish(reverb(mix({ buffer: low }, { buffer: high, gain: 0.5 }, ...hits), { mix: 0.22, tail: 0.9, decay: 0.84 }));
}

function boom(): Float32Array {
	const pitch = glide([
		[0, 125],
		[0.06, 70],
		[0.5, 42],
		[1.6, 36],
	]);
	const decay = (t: number) =>
		Math.sin((Math.PI / 2) * Math.min(t / 0.008, 1)) * Math.exp(-t / 0.55) * Math.min((1.6 - t) / 0.4, 1);
	const body = mix(
		{ buffer: sine(1.6, pitch, decay) },
		{ buffer: sine(1.6, (t) => pitch(t) * 2.01, (t) => decay(t) * 0.45) },
		{ buffer: sine(1.6, (t) => pitch(t) * 3.02, (t) => decay(t) * 0.2) },
		{ buffer: filter(click({ duration: 0.05, center: 900, q: 0.6, decay: 0.01, seed: 71 }), "lowpass", 1800), gain: 0.5 },
	);
	return finish(reverb(drive(body, 2.2), { mix: 0.25, tail: 1.2, decay: 0.86, damp: 0.5 }));
}

function scratch(): Float32Array {
	const rate = curve([
		[0, 0.15],
		[0.05, 2.4],
		[0.11, 0.25],
		[0.16, 2.8],
		[0.27, 1.1],
		[0.36, 0.05],
	]);
	const swish = filter(noise(0.38, 81), "bandpass", (t) => 300 + 1500 * rate(t), 2.2);
	const grind = tone({
		duration: 0.38,
		f0: (t) => 40 + 190 * rate(t),
		amp: () => 1,
		maxFreq: 6000,
		spectrum: (_freq, k) => 1 / k ** 0.8,
	});
	const amp = curve([
		[0, 0],
		[0.02, 1],
		[0.3, 0.9],
		[0.37, 0],
	]);
	return finish(
		reverb(shape(drive(mix({ buffer: swish, gain: 1.4 }, { buffer: grind, gain: 0.35 }), 2), amp), { mix: 0.1, tail: 0.3 }),
	);
}

// ---------------------------------------------------------------------------
// arcade: chiptune.

function powerUp(): Float32Array {
	const steps = ["C5", "E5", "G5", "C6", "E6", "G6"];
	const notes: Note[] = steps.map((name, index) => ({ f: hz(name), at: index * 0.055, len: 0.05 }));
	notes.push({ f: hz("C7"), at: steps.length * 0.055, len: 0.32 });
	const amp = (t: number) => {
		const last = notes[notes.length - 1]!;
		if (t >= last.at) return 0.9 * Math.exp(-(t - last.at) / 0.18);
		return 0.8;
	};
	const lead = chip({
		duration: 0.75,
		f0: melody(notes, 0.003),
		amp,
		duty: 0.25,
		vibrato: { rate: 9, depth: (t) => (t > 0.4 ? 0.012 : 0) },
	});
	return finish(reverb(lead, { mix: 0.08, tail: 0.25 }), 0.7);
}

function blipQuestion(): Float32Array {
	const notes: Note[] = [
		{ f: hz("A5"), at: 0, len: 0.08 },
		{ f: hz("E6"), at: 0.14, len: 0.16 },
	];
	const lead = chip({
		duration: 0.36,
		f0: melody(notes, 0.002),
		amp: articulate(notes, { attack: 0.003, release: 0.03, sustain: 0.6 }),
		duty: 0.5,
	});
	return finish(reverb(lead, { mix: 0.12, tail: 0.3 }), 0.7);
}

function gameOver(): Float32Array {
	const notes: Note[] = [
		{ f: hz("G4"), at: 0, len: 0.16 },
		{ f: hz("E4"), at: 0.2, len: 0.16 },
		{ f: hz("C4"), at: 0.4, len: 0.16 },
		{ f: hz("C3"), at: 0.62, len: 0.7 },
	];
	const lead = chip({
		duration: 1.4,
		f0: melody(notes, 0.004),
		amp: articulate(notes, { attack: 0.004, release: 0.08, sustain: 0.55 }),
		duty: 0.5,
		vibrato: { rate: 6, depth: (t) => (t > 0.8 ? 0.02 : 0) },
	});
	return finish(reverb(lead, { mix: 0.1, tail: 0.35 }), 0.7);
}

function zap(): Float32Array {
	const lead = chip({
		duration: 0.28,
		f0: glide([
			[0, 1900],
			[0.27, 110],
		]),
		amp: curve([
			[0, 0.9],
			[0.2, 0.6],
			[0.28, 0],
		]),
		duty: 0.125,
	});
	return finish(reverb(lead, { mix: 0.12, tail: 0.25 }), 0.65);
}

// ---------------------------------------------------------------------------
// zen: bells and wood.

const BELL_PARTIALS = [
	[0.56, 0.6, 1.4],
	[0.92, 0.45, 1.1],
	[1, 1, 0.9],
	[1.19, 0.4, 0.7],
	[1.71, 0.35, 0.5],
	[2, 0.3, 0.45],
	[2.74, 0.25, 0.32],
	[3, 0.2, 0.25],
	[3.76, 0.15, 0.18],
] as const;

function chime(): Float32Array {
	return finish(
		reverb(
			mix(
				{ buffer: bell({ f: hz("E5"), duration: 2, partials: BELL_PARTIALS }) },
				{ at: 0.16, buffer: bell({ f: hz("B5"), duration: 2, partials: BELL_PARTIALS }), gain: 0.8 },
			),
			{ mix: 0.25, tail: 1, decay: 0.82 },
		),
		0.7,
	);
}

function bowl(): Float32Array {
	const strike = (f: number) =>
		mix(
			{ buffer: sine(1.3, () => f, (t) => Math.min(t / 0.02, 1) * Math.exp(-t / 0.5)) },
			{ buffer: sine(1.3, () => f * 1.004, (t) => 0.7 * Math.min(t / 0.02, 1) * Math.exp(-t / 0.5)) },
			{ buffer: sine(1.3, () => f * 2.71, (t) => 0.2 * Math.exp(-t / 0.2)) },
		);
	return finish(
		reverb(mix({ buffer: strike(hz("E5")) }, { at: 0.22, buffer: strike(hz("A5")) }), { mix: 0.25, tail: 0.9 }),
		0.65,
	);
}

function gong(): Float32Array {
	const partials = [
		[1, 1, 1.6],
		[1.48, 0.7, 1.2],
		[1.98, 0.6, 1.1],
		[2.44, 0.45, 0.9],
		[2.9, 0.35, 0.7],
		[3.6, 0.25, 0.5],
		[4.2, 0.2, 0.4],
		[5.3, 0.12, 0.3],
	] as const;
	const body = bell({ f: 98, duration: 2.4, partials, attack: 0.03 });
	const mallet = filter(noise(0.08, 91), "lowpass", 900);
	shape(mallet, (t) => Math.exp(-t / 0.015));
	return finish(reverb(mix({ buffer: body }, { buffer: mallet, gain: 0.4 }), { mix: 0.3, tail: 1.2, decay: 0.85 }), 0.75);
}

function woodTick(): Float32Array {
	const tick = (f: number, seed: number) =>
		mix(
			{ buffer: click({ duration: 0.08, center: f * 1.1, q: 9, decay: 0.012, seed }), gain: 2 },
			{ buffer: sine(0.08, () => f, (t) => Math.exp(-t / 0.018)) },
		);
	return finish(reverb(mix({ buffer: tick(880, 95) }, { at: 0.11, buffer: tick(660, 96), gain: 0.8 }), { mix: 0.12, tail: 0.3 }), 0.6);
}

// ---------------------------------------------------------------------------
// minimal: quiet interface beeps.

function beeps(notes: Note[], options: { square?: boolean; peak?: number } = {}): Float32Array {
	const sound = tone({
		duration: Math.max(...notes.map((note) => note.at + note.len)) + 0.12,
		f0: melody(notes, 0.002),
		amp: articulate(notes, { attack: 0.006, release: 0.1, sustain: 0.4 }),
		maxFreq: 6000,
		spectrum: (_freq, k) => (options.square ? (k % 2 === 1 ? 0.6 / k : 0) : k === 1 ? 1 : k === 2 ? 0.08 : 0),
	});
	return finish(reverb(sound, { mix: 0.1, tail: 0.25 }), options.peak ?? 0.6);
}

// ---------------------------------------------------------------------------
// shared helpers for the newer themes.

/** Band-limited sawtooth. */
function saw(options: {
	duration: number;
	f0: (t: number) => number;
	amp: (t: number) => number;
	maxFreq?: number;
	seed?: number;
	phase?: number;
}): Float32Array {
	return tone({
		phase: options.phase,
		duration: options.duration,
		f0: options.f0,
		amp: options.amp,
		maxFreq: options.maxFreq ?? 6000,
		seed: options.seed,
		spectrum: (_freq, k) => 1 / k,
	});
}

/** Several detuned saws per note, like an analog polysynth. */
function supersaw(options: {
	notes: readonly number[];
	duration: number;
	amp: (t: number) => number;
	bend?: (t: number) => number;
	detune?: number;
}): Float32Array {
	const detune = options.detune ?? 0.006;
	const bend = options.bend ?? (() => 1);
	const voices = options.notes.flatMap((f, noteIndex) =>
		[-1, 0, 1].map((spread, voiceIndex) => ({
			buffer: saw({
				duration: options.duration,
				f0: (t) => f * bend(t) * (1 + spread * detune),
				amp: options.amp,
				maxFreq: 3500,
				seed: 200 + noteIndex * 3 + voiceIndex,
				phase: (noteIndex * 3 + voiceIndex) * 2.399,
			}),
			gain: spread === 0 ? 1 : 0.7,
		})),
	);
	return mix(...voices);
}

/** Soft attack/release envelope for a single sustained event. */
function swell(duration: number, attack: number, release: number, level = 1): (t: number) => number {
	return (t) => {
		if (t < 0 || t > duration) return 0;
		const rise = Math.min(t / attack, 1);
		const fall = Math.min((duration - t) / release, 1);
		return level * Math.sin((Math.PI / 2) * rise) * Math.sin((Math.PI / 2) * Math.max(fall, 0));
	};
}

// ---------------------------------------------------------------------------
// scifi: starship console.

function warpChirp(): Float32Array {
	const pitch = glide([
		[0, 320],
		[0.28, 2600],
		[0.4, 2400],
	]);
	const env = swell(0.42, 0.02, 0.18);
	const body = mix(
		{ buffer: sine(0.45, pitch, env) },
		{ buffer: sine(0.45, (t) => pitch(t) * 1.5, (t) => env(t) * 0.35) },
		{ buffer: sine(0.45, (t) => pitch(t) * 0.5, (t) => env(t) * 0.4) },
	);
	return finish(reverb(body, { mix: 0.3, tail: 0.7, decay: 0.8 }), 0.7);
}

function commBeep(): Float32Array {
	const chirp = (f: number) =>
		tone({
			duration: 0.1,
			f0: () => f,
			amp: swell(0.1, 0.006, 0.03),
			maxFreq: 6000,
			spectrum: (_freq, k) => (k === 1 ? 1 : k === 3 ? 0.18 : 0),
		});
	return finish(
		reverb(
			mix(
				{ buffer: chirp(hz("E6")) },
				{ at: 0.12, buffer: chirp(hz("A6")) },
				{ at: 0.3, buffer: chirp(hz("E6")), gain: 0.8 },
				{ at: 0.42, buffer: chirp(hz("A6")), gain: 0.8 },
			),
			{ mix: 0.18, tail: 0.4 },
		),
		0.6,
	);
}

function redAlert(): Float32Array {
	const cycle = 0.42;
	const pitch = (t: number) => {
		const local = (t % cycle) / cycle;
		return 330 * 2 ** (local * 0.85);
	};
	const amp = (t: number) => {
		const local = t % cycle;
		return swell(cycle, 0.02, 0.06)(local) * (t < cycle * 2 ? 1 : 0);
	};
	const horn = tone({
		duration: cycle * 2,
		f0: pitch,
		amp,
		maxFreq: 6000,
		spectrum: (freq, k) => {
			const x = (freq - 1400) / 1200;
			return (0.5 + 1 / (1 + x * x)) / k;
		},
	});
	return finish(reverb(filter(horn, "lowpass", 4500), { mix: 0.15, tail: 0.5 }));
}

function powerDown(): Float32Array {
	const pitch = glide([
		[0, 900],
		[0.75, 55],
	]);
	const env = swell(0.8, 0.01, 0.25);
	const body = saw({ duration: 0.8, f0: pitch, amp: env, maxFreq: 4000 });
	const closing = filter(body, "lowpass", glide([
		[0, 3500],
		[0.8, 180],
	]), 2.5);
	return finish(reverb(closing, { mix: 0.15, tail: 0.4 }));
}

// ---------------------------------------------------------------------------
// retro: original desktop-OS style sounds.

function startupChord(): Float32Array {
	const notes = ["C3", "G3", "C4", "E4", "G4", "D5"].map(hz);
	const env = (t: number) =>
		Math.min(t / 0.12, 1) ** 2 * Math.exp(-Math.max(t - 0.12, 0) / 0.9) * Math.min((2.2 - t) / 0.6, 1);
	const pad = mix(
		...notes.map((f, index) => ({
			buffer: tone({
				duration: 2.2,
				f0: () => f * (1 + (index % 2 ? 0.002 : -0.002)),
				amp: env,
				maxFreq: 5000,
				seed: 300 + index,
				spectrum: (_freq, k) => Math.exp(-(k - 1) / 1.6) / k,
			}),
			gain: index < 2 ? 0.8 : 0.6,
		})),
	);
	return finish(reverb(pad, { mix: 0.3, tail: 1, decay: 0.84 }), 0.7);
}

function ding(): Float32Array {
	const partials = [
		[1, 1, 0.55],
		[2.01, 0.35, 0.3],
		[3.02, 0.12, 0.18],
		[4.17, 0.06, 0.1],
	] as const;
	return finish(reverb(bell({ f: hz("A5"), duration: 1.2, partials, attack: 0.003 }), { mix: 0.15, tail: 0.4 }), 0.65);
}

function criticalThud(): Float32Array {
	const env = (t: number) => Math.min(t / 0.006, 1) * Math.exp(-t / 0.14);
	const square = (f: number, seed: number) =>
		tone({
			duration: 0.6,
			f0: () => f,
			amp: env,
			maxFreq: 3500,
			seed,
			phase: seed * 2.399,
			spectrum: (_freq, k) => (k % 2 === 1 ? 1 / k : 0),
		});
	const low = sine(0.6, glide([
		[0, 140],
		[0.2, 60],
	]), (t) => Math.min(t / 0.003, 1) * Math.exp(-t / 0.12));
	return finish(
		reverb(mix({ buffer: square(hz("E3"), 310) }, { buffer: square(hz("F3"), 311), gain: 0.8 }, { buffer: low, gain: 1.2 }), {
			mix: 0.12,
			tail: 0.4,
		}),
	);
}

function mouseClick(): Float32Array {
	const tick = (center: number, seed: number) =>
		mix(
			{ buffer: click({ duration: 0.03, center, q: 3, decay: 0.003, seed }) },
			{ buffer: sine(0.03, () => center / 2, (t) => Math.min(t / 0.0005, 1) * Math.exp(-t / 0.004)), gain: 0.4 },
		);
	return finish(
		reverb(mix({ buffer: tick(3200, 320) }, { at: 0.07, buffer: tick(2600, 321), gain: 0.7 }), { mix: 0.12, tail: 0.2 }),
		0.5,
	);
}

// ---------------------------------------------------------------------------
// cartoon: slide whistles, springs, and bonks.

function slideWhistle(from: number, to: number, duration: number, seed: number): Float32Array {
	const pitch = glide([
		[0, from],
		[duration * 0.85, to],
		[duration, to],
	]);
	const env = swell(duration, 0.04, 0.08);
	const tonePart = sine(duration, (t) => pitch(t) * (1 + 0.012 * Math.sin(2 * Math.PI * 7 * t)), env);
	const breath = shape(filter(noise(duration, seed), "bandpass", (t) => pitch(t), 6), (t) => env(t) * 0.25);
	return mix({ buffer: tonePart }, { buffer: breath }, { buffer: sine(duration, (t) => pitch(t) * 2, (t) => env(t) * 0.08) });
}

function whistleUp(): Float32Array {
	return finish(reverb(slideWhistle(480, 1900, 0.55, 401), { mix: 0.12, tail: 0.3 }), 0.7);
}

function boing(): Float32Array {
	const duration = 0.7;
	const pitch = (t: number) => 170 * (1 + 0.45 * Math.sin(2 * Math.PI * 11 * t) * Math.exp(-t / 0.3)) * (1 + t * 0.35);
	const env = (t: number) => Math.min(t / 0.004, 1) * Math.exp(-t / 0.22) * Math.min((duration - t) / 0.05, 1);
	const spring = tone({
		duration,
		f0: pitch,
		amp: env,
		maxFreq: 4000,
		spectrum: (freq, k) => {
			const x = (freq - 900) / 500;
			return (0.4 + 1 / (1 + x * x)) / k;
		},
	});
	return finish(reverb(spring, { mix: 0.1, tail: 0.3 }));
}

function bonkSlide(): Float32Array {
	const bonk = mix(
		{ buffer: click({ duration: 0.12, center: 900, q: 6, decay: 0.03, seed: 410 }), gain: 1.4 },
		{ buffer: sine(0.15, glide([
			[0, 520],
			[0.15, 380],
		]), (t) => Math.min(t / 0.002, 1) * Math.exp(-t / 0.05)) },
	);
	return finish(
		reverb(mix({ buffer: bonk }, { at: 0.18, buffer: slideWhistle(1500, 260, 0.75, 411), gain: 0.8 }), { mix: 0.12, tail: 0.35 }),
	);
}

function pop(): Float32Array {
	const body = sine(0.08, glide([
		[0, 1400],
		[0.06, 320],
	]), (t) => Math.min(t / 0.001, 1) * Math.exp(-t / 0.02));
	return finish(
		reverb(mix({ buffer: body }, { buffer: click({ duration: 0.03, center: 2500, q: 1.2, decay: 0.003, seed: 420 }), gain: 0.4 }), {
			mix: 0.12,
			tail: 0.2,
		}),
		0.6,
	);
}

// ---------------------------------------------------------------------------
// synthwave: detuned analog synths.

function chordStab(): Float32Array {
	const notes = ["A3", "C4", "E4", "G4", "B4"].map(hz);
	const env = (t: number) => Math.min(t / 0.01, 1) * Math.exp(-t / 0.5) * Math.min((1.4 - t) / 0.4, 1);
	const stab = supersaw({ notes, duration: 1.4, amp: env });
	const shaped = filter(stab, "lowpass", glide([
		[0, 5000],
		[0.6, 700],
		[1.4, 500],
	]), 1.2);
	return finish(reverb(shaped, { mix: 0.25, tail: 0.9, decay: 0.82 }), 0.85);
}

function arp(): Float32Array {
	const names = ["A4", "C5", "E5", "A5", "E5", "C5"];
	const step = 0.085;
	const notes: Note[] = names.map((name, index) => ({ f: hz(name), at: index * step, len: step * 0.8 }));
	const lead = saw({
		duration: names.length * step + 0.1,
		f0: melody(notes, 0.002),
		amp: articulate(notes, { attack: 0.004, release: 0.04, sustain: 0.5 }),
		maxFreq: 6000,
	});
	return finish(reverb(filter(lead, "lowpass", 2600, 1.5), { mix: 0.3, tail: 0.6, decay: 0.8 }), 0.65);
}

function detunedFall(): Float32Array {
	const notes = ["E4", "G4", "B4"].map(hz);
	const bend = glide([
		[0, 1],
		[0.25, 1],
		[1.2, 0.5],
	]);
	const env = swell(1.25, 0.015, 0.4);
	const chord = supersaw({ notes, duration: 1.25, amp: env, bend, detune: 0.012 });
	return finish(
		reverb(filter(chord, "lowpass", glide([
			[0, 3500],
			[1.25, 400],
		])), { mix: 0.25, tail: 0.6 }),
	);
}

function filterSweep(): Float32Array {
	const duration = 0.6;
	const env = swell(duration, 0.01, 0.2);
	const source = mix(
		{ buffer: saw({ duration, f0: () => hz("A2"), amp: env, maxFreq: 6000 }) },
		{ buffer: shape(noise(duration, 430), env), gain: 0.25 },
	);
	const swept = filter(source, "lowpass", glide([
		[0, 6000],
		[duration, 150],
	]), 4);
	return finish(reverb(swept, { mix: 0.2, tail: 0.4 }));
}

// ---------------------------------------------------------------------------

export const THEMES: readonly Theme[] = [
	{
		id: "minimal",
		name: "Minimal",
		description: "Quiet, short interface beeps",
		labels: { done: "Rising beep", question: "Double ping", error: "Falling beep", aborted: "Low blip" },
		render: {
			done: () =>
				beeps([
					{ f: hz("A5"), at: 0, len: 0.09 },
					{ f: hz("E6"), at: 0.1, len: 0.2 },
				]),
			question: () =>
				beeps([
					{ f: hz("C6"), at: 0, len: 0.08 },
					{ f: hz("C6"), at: 0.16, len: 0.08 },
				]),
			error: () =>
				beeps(
					[
						{ f: hz("E5"), at: 0, len: 0.12 },
						{ f: hz("A4"), at: 0.14, len: 0.24 },
					],
					{ square: true, peak: 0.45 },
				),
			aborted: () => beeps([{ f: hz("E4"), at: 0, len: 0.1 }], { peak: 0.5 }),
		},
	},
	{
		id: "zen",
		name: "Zen",
		description: "Bells, singing bowl, gong, wood block",
		labels: { done: "Bell chime", question: "Singing bowl", error: "Gong", aborted: "Wood tick" },
		render: { done: chime, question: bowl, error: gong, aborted: woodTick },
	},
	{
		id: "arcade",
		name: "Arcade",
		description: "Chiptune power-up, blips, game over, zap",
		labels: { done: "Power-up", question: "Blip blip", error: "Game over", aborted: "Zap" },
		render: { done: powerUp, question: blipQuestion, error: gameOver, aborted: zap },
	},
	{
		id: "retro",
		name: "Retro OS",
		description: "Original desktop-style startup chord, ding, critical thud, click",
		labels: { done: "Startup chord", question: "Ding", error: "Critical thud", aborted: "Click" },
		render: { done: startupChord, question: ding, error: criticalThud, aborted: mouseClick },
	},
	{
		id: "scifi",
		name: "Sci-fi",
		description: "Starship console: warp chirp, comm beep, red alert, power down",
		labels: { done: "Warp chirp", question: "Comm beep", error: "Red alert", aborted: "Power down" },
		render: { done: warpChirp, question: commBeep, error: redAlert, aborted: powerDown },
	},
	{
		id: "synthwave",
		name: "Synthwave",
		description: "80s analog synths: chord stab, arpeggio, detuned fall, filter sweep",
		labels: { done: "Chord stab", question: "Arpeggio", error: "Detuned fall", aborted: "Filter sweep" },
		render: { done: chordStab, question: arp, error: detunedFall, aborted: filterSweep },
	},
	{
		id: "cartoon",
		name: "Cartoon",
		description: "Slide whistle, boing, bonk, pop",
		labels: { done: "Slide whistle", question: "Boing", error: "Bonk + slide down", aborted: "Pop" },
		render: { done: whistleUp, question: boing, error: bonkSlide, aborted: pop },
	},
	{
		id: "hype",
		name: "Hype",
		description: "Air horn, dramatic sting, deep boom, record scratch",
		labels: { done: "Air horn", question: "Dun dun dunnn", error: "Boom", aborted: "Record scratch" },
		render: { done: airhorn, question: dramatic, error: boom, aborted: scratch },
	},
	{
		id: "gags",
		name: "Gags",
		description: "Meme-style voice gags: faah, huh?, sad trombone, bruh",
		labels: { done: "Faah", question: "Huh?", error: "Sad trombone", aborted: "Bruh" },
		render: { done: faah, question: huh, error: sadTrombone, aborted: bruh },
	},
];

export const DEFAULT_THEME = "minimal";

/** Old theme ids that still resolve, so existing configs keep working. */
const ALIASES: Record<string, string> = { reels: "gags" };

export function findTheme(id: string): Theme | undefined {
	const key = id.trim().toLowerCase();
	const resolved = ALIASES[key] ?? key;
	return THEMES.find((theme) => theme.id === resolved);
}
