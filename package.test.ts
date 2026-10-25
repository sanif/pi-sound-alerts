import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir;

interface PackageManifest {
	name: string;
	version: string;
	license: string;
	keywords: string[];
	files: string[];
	os?: string[];
	pi?: { extensions?: string[] };
	peerDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
	publishConfig?: { access?: string };
	repository?: { url?: string };
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;

describe("Pi package manifest", () => {
	test("declares a public Pi extension package with host peers", () => {
		expect(pkg.name).toBe("pi-sound-alerts");
		expect(pkg.version).toBe("0.1.0");
		expect(pkg.license).toBe("MIT");
		expect(pkg.keywords).toContain("pi-package");
		expect(pkg.pi?.extensions).toEqual(["./index.ts"]);
		expect(pkg.peerDependencies).toEqual({
			"@earendil-works/pi-coding-agent": "*",
			"@earendil-works/pi-tui": "*",
		});
		expect(pkg.dependencies).toBeUndefined();
		expect(pkg.publishConfig?.access).toBe("public");
		expect(pkg.os).toEqual(["darwin", "linux"]);
		expect(pkg.repository?.url).toBe("git+https://github.com/sanif/pi-sound-alerts.git");
	});

	test("publishes only runtime source and public documentation, no audio files", () => {
		const output = execFileSync("bun", ["pm", "pack", "--dry-run"], { cwd: root, encoding: "utf8" });
		const packed = [...output.matchAll(/^packed\s+\S+\s+(\S+)$/gm)].map((match) => match[1]).sort();
		expect(packed).toEqual([...pkg.files, "package.json"].sort());
		expect(packed.some((file) => /\.(wav|mp3|ogg)$/i.test(file ?? ""))).toBe(false);
	});
});
