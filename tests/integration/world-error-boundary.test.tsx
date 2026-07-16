import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorldErrorBoundary } from "@/components/world/world-error-boundary";

function BrokenScene(): never {
  throw new Error("renderer failed");
}

describe("world error boundary", () => {
  it("notifies its owner so the route can switch to a complete fallback", () => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <WorldErrorBoundary
        onError={onError}
        renderFallback={() => <p>Direct reconstruction available.</p>}
        resetKey={0}
      >
        <BrokenScene />
      </WorldErrorBoundary>,
    );

    expect(screen.getByText("Direct reconstruction available.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
