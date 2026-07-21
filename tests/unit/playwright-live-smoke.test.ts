import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const smokeSourceText = readFileSync(
  resolve(process.cwd(), "tests/live/openai-provider-smoke.spec.ts"),
  "utf8",
);
const smokeSource = ts.createSourceFile(
  "openai-provider-smoke.spec.ts",
  smokeSourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function collectNodes<T extends ts.Node>(
  predicate: (node: ts.Node) => node is T,
): T[] {
  const matches: T[] = [];
  const visit = (node: ts.Node): void => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(smokeSource);
  return matches;
}

function isRequestPostCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "request" &&
    node.expression.name.text === "post"
  );
}

describe("live OpenAI smoke safeguards", () => {
  it("sets at least 60 seconds on every provider-backed API request", () => {
    const postCalls = collectNodes(isRequestPostCall);

    expect(postCalls).toHaveLength(3);
    for (const call of postCalls) {
      const options = call.arguments[1];
      expect(Boolean(options && ts.isObjectLiteralExpression(options))).toBe(
        true,
      );
      if (!options || !ts.isObjectLiteralExpression(options)) continue;

      const timeout = options.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "timeout",
      );
      expect(timeout, call.getText(smokeSource)).toBeDefined();
      if (!timeout) continue;
      expect(ts.isNumericLiteral(timeout.initializer)).toBe(true);
      if (!ts.isNumericLiteral(timeout.initializer)) continue;
      expect(Number(timeout.initializer.text)).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("does not pin the model to one preferred E3 reaction unit", () => {
    const stringLiterals = collectNodes(
      (node): node is ts.StringLiteral => ts.isStringLiteral(node),
    ).map((literal) => literal.text);

    expect(stringLiterals).not.toContain("REACTION-DROUET-E3-QUALIFY");
  });

  it("parses returned speech bytes and checks playable WAV metadata", () => {
    const parseCalls = collectNodes(
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "parseBuffer",
    );
    const speechParse = parseCalls.find((call) => {
      const input = call.arguments[0];
      return Boolean(
        input && ts.isIdentifier(input) && input.text === "speechBytes",
      );
    });

    expect(speechParse).toBeDefined();

    const checkedFormatFields = new Set(
      collectNodes(
        (node): node is ts.PropertyAccessExpression =>
          ts.isPropertyAccessExpression(node) &&
          node.expression.getText(smokeSource) === "speechMetadata.format",
      ).map((property) => property.name.text),
    );
    for (const field of [
      "hasAudio",
      "container",
      "duration",
      "numberOfSamples",
      "sampleRate",
      "numberOfChannels",
    ]) {
      expect(checkedFormatFields).toContain(field);
    }
  });
});
