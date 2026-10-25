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
// reels: original voice and gag sounds in the style of short-video memes.

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
	const decay = (t: number) => Math.min(t / 0.004, 1) * Math.exp(-t / 0.55);
	const body = mix(
		{ buffer: sine(1.6, pitch, decay) },
		{ buffer: sine(1.6, (t) => pitch(t) * 2.01, (t) => decay(t) * 0.45) },
		{ buffer: sine(1.6, (t) => pitch(t) * 3.02, (t) => decay(t) * 0.2) },
		{ buffer: click({ duration: 0.05, center: 1600, q: 0.6, decay: 0.008, seed: 71 }), gain: 0.6 },
	);
	return finish(reverb(drive(body, 3.2), { mix: 0.25, tail: 1.2, decay: 0.86, damp: 0.5 }));
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
	return finish(shape(drive(mix({ buffer: swish, gain: 1.4 }, { buffer: grind, gain: 0.35 }), 2), amp));
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
	return finish(lead, 0.7);
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
	return finish(lead, 0.7);
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
	return finish(lead, 0.65);
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

export const THEMES: readonly Theme[] = [
	{
		id: "reels",
		name: "Reels",
		description: "Meme-style voice gags: faah, huh?, sad trombone, bruh",
		labels: { done: "Faah", question: "Huh?", error: "Sad trombone", aborted: "Bruh" },
		render: { done: faah, question: huh, error: sadTrombone, aborted: bruh },
	},
	{
		id: "hype",
		name: "Hype",
		description: "Air horn, dramatic sting, deep boom, record scratch",
		labels: { done: "Air horn", question: "Dun dun dunnn", error: "Boom", aborted: "Record scratch" },
		render: { done: airhorn, question: dramatic, error: boom, aborted: scratch },
	},
	{
		id: "arcade",
		name: "Arcade",
		description: "Chiptune power-up, blips, game over, zap",
		labels: { done: "Power-up", question: "Blip blip", error: "Game over", aborted: "Zap" },
		render: { done: powerUp, question: blipQuestion, error: gameOver, aborted: zap },
	},
	{
		id: "zen",
		name: "Zen",
		description: "Bells, singing bowl, gong, wood block",
		labels: { done: "Bell chime", question: "Singing bowl", error: "Gong", aborted: "Wood tick" },
		render: { done: chime, question: bowl, error: gong, aborted: woodTick },
	},
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
];

export const DEFAULT_THEME = "reels";

export function findTheme(id: string): Theme | undefined {
	return THEMES.find((theme) => theme.id === id.trim().toLowerCase());
}
