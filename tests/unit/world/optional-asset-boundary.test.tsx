import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { OptionalAssetBoundary } from "@/components/world/environment/optional-asset-boundary";

function ThrowingAsset(): ReactNode {
  throw new Error("private loader detail");
}

describe("OptionalAssetBoundary", () => {
  it("reports loaded only after the detailed child mounts", () => {
    const onResolved = vi.fn();

    render(
      <OptionalAssetBoundary
        assetId="archive-table"
        fallback={<span>fallback</span>}
        onResolved={onResolved}
      >
        <span>detailed asset</span>
      </OptionalAssetBoundary>,
    );

    expect(screen.getByText("detailed asset")).toBeInTheDocument();
    expect(onResolved).toHaveBeenCalledOnce();
    expect(onResolved).toHaveBeenCalledWith("loaded");
  });

  it("reports the deterministic fallback and emits one sanitized stable-ID warning", () => {
    const onResolved = vi.fn();
    const onWarning = vi.fn();
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const view = render(
      <OptionalAssetBoundary
        assetId="district-facades"
        fallback={<span>procedural fallback</span>}
        onResolved={onResolved}
        onWarning={onWarning}
      >
        <ThrowingAsset />
      </OptionalAssetBoundary>,
    );

    expect(screen.getByText("procedural fallback")).toBeInTheDocument();
    expect(onResolved).toHaveBeenCalledOnce();
    expect(onResolved).toHaveBeenCalledWith("fallback");
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning).toHaveBeenCalledWith({
      assetId: "district-facades",
      status: "fallback",
    });
    expect(consoleWarning).toHaveBeenCalledOnce();
    expect(consoleWarning).toHaveBeenCalledWith(
      "[world-asset:district-facades] Using deterministic fallback.",
    );
    expect(consoleWarning).not.toHaveBeenCalledWith(
      expect.stringContaining("private loader detail"),
    );

    view.rerender(
      <OptionalAssetBoundary
        assetId="district-facades"
        fallback={<span>procedural fallback</span>}
        onResolved={onResolved}
        onWarning={onWarning}
      >
        <ThrowingAsset />
      </OptionalAssetBoundary>,
    );
    expect(onWarning).toHaveBeenCalledOnce();
    consoleWarning.mockRestore();
  });
});
