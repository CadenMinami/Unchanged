import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const releaseGates = Object.freeze([
  { label: "unit and integration tests", args: ["test"], noKey: false },
  { label: "TypeScript", args: ["run", "typecheck"], noKey: false },
  { label: "ESLint", args: ["run", "lint"], noKey: false },
  { label: "production build", args: ["run", "build"], noKey: true },
  {
    label: "ordinary production browser tests",
    args: ["run", "test:e2e"],
    noKey: true,
  },
  {
    label: "Classroom performance proxy",
    args: ["run", "test:performance"],
    noKey: true,
  },
  {
    label: "submission screenshot capture",
    args: ["run", "capture:screenshots"],
    noKey: true,
  },
]);

// Application gates verify the deterministic fallback package only. Live-provider
// testing is deliberate, opt-in, and kept in its separate credentialed command.
const noKeyEnvironment = {
  ...process.env,
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  OPENAI_SPEECH_MODEL: "",
  SPEECH_AUTHORIZATION_SECRET: "",
};

for (const gate of releaseGates) {
  console.log(`\n[verify:release] ${gate.label}`);
  const result = spawnSync(npmCommand, gate.args, {
    cwd: process.cwd(),
    env: gate.noKey ? noKeyEnvironment : process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`\n[verify:release] Could not start ${gate.label}.`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n[verify:release] Failed at ${gate.label}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[verify:release] All no-key local release gates passed.");
