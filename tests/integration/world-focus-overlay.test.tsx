import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { FocusOverlayHost } from "@/components/world/focus-overlay-host";

describe("world focus overlay", () => {
  it("renders reviewed E3 metadata in a modal DOM surface and restores focus", async () => {
    const user = userEvent.setup();
    const invokerRef = createRef<HTMLButtonElement>();
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button ref={invokerRef}>Inspect table</button>
        <FocusOverlayHost evidenceId="E3" invokerRef={invokerRef} onClose={onClose} />
      </>,
    );

    expect(screen.getByRole("dialog", { name: /drouet's report/i })).toBeInTheDocument();
    expect(screen.getByText(/verified historical record/i)).toBeInTheDocument();
    expect(screen.getByText(/participant testimony/i)).toBeInTheDocument();
    expect(screen.getByText(/S2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close evidence/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("link", { name: /open catalog record/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /close evidence/i })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: /open catalog record/i })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /close evidence/i }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<button ref={invokerRef}>Inspect table</button>);
    expect(invokerRef.current).toHaveFocus();
  });

  it("labels reconstructed evidence as an evidence item rather than an archive record", () => {
    const invokerRef = createRef<HTMLButtonElement>();

    render(
      <>
        <button ref={invokerRef}>Inspect dossier</button>
        <FocusOverlayHost evidenceId="E2" invokerRef={invokerRef} onClose={vi.fn()} />
      </>,
    );

    const dialog = screen.getByRole("dialog", {
      name: /royal travel-preparation dossier/i,
    });
    const dialogQueries = within(dialog);
    expect(
      dialogQueries.getByText("Cited historical reconstruction"),
    ).toBeInTheDocument();
    expect(dialogQueries.getByText("Evidence item")).toBeInTheDocument();
    expect(dialogQueries.queryByText("Archive record")).not.toBeInTheDocument();
  });
});
