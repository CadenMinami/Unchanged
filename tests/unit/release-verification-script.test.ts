import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

const releaseScriptPath = join(
  process.cwd(),
  "scripts/verify-release.mjs",
);

describe("local release verification command", () => {
  it("runs the complete no-key local release sequence", () => {
    const source = readFileSync(releaseScriptPath, "utf8");

    expect(packageJson.scripts["verify:release"]).toBe(
      "node scripts/verify-release.mjs",
    );
    expect(source).toContain('"test"');
    expect(source).toContain('"typecheck"');
    expect(source).toContain('"lint"');
    expect(source).toContain('"build"');
    expect(source).toContain('"test:e2e"');
    expect(source).toContain('"test:performance"');
    expect(source).toContain('"capture:screenshots"');
  });

  it("clears provider credentials before launching application gates", () => {
    const source = readFileSync(releaseScriptPath, "utf8");

    expect(source).toContain('noKey: false');
    expect(source).toContain('noKey: true');
    expect(source).toContain('env: gate.noKey ? noKeyEnvironment : process.env');
    expect(source).toContain('OPENAI_API_KEY: ""');
    expect(source).toContain('OPENAI_MODEL: ""');
    expect(source).toContain('OPENAI_SPEECH_MODEL: ""');
    expect(source).toContain('SPEECH_AUTHORIZATION_SECRET: ""');
    expect(source).toContain('HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: ""');
  });
});
