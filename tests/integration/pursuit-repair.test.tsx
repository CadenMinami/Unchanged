import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PursuitRuntime } from "@/components/world/repair/pursuit-runtime";
import { ReducedMotionRepair } from "@/components/world/repair/reduced-motion-repair";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";

const reconstruction = loadVarennesReconstruction();

describe("guided pursuit repair", () => {
  it("keeps a complete non-WebGL route that requests only the current reducer step", async () => {
    const user = userEvent.setup();
    const onRequestStep = vi.fn();

    render(
      <PursuitRuntime
        capabilityCheck={() => false}
        completedActionIds={[]}
        completedStepIds={[]}
        onRequestAction={vi.fn()}
        onRequestStep={onRequestStep}
      />,
    );

    expect(screen.getByText(/direct reconstruction controls/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: reconstruction.repairSteps[0]!.actionLabel,
      }),
    );
    expect(onRequestStep).toHaveBeenCalledWith("RS-01-ROUTE");
  });

  it("keeps both local actions independent before requesting their joint step", async () => {
    const user = userEvent.setup();
    const onRequestAction = vi.fn();
    const onRequestStep = vi.fn();
    const firstFourSteps = reconstruction.repairSteps
      .slice(0, 4)
      .map((step) => step.id);
    const { rerender } = render(
      <PursuitRuntime
        capabilityCheck={() => false}
        completedActionIds={["RA-05-PASSPORT"]}
        completedStepIds={firstFourSteps}
        onRequestAction={onRequestAction}
        onRequestStep={onRequestStep}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: reconstruction.repairSteps[4]!.actionLabel,
      }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /restore passage control/i }));
    expect(onRequestAction).toHaveBeenCalledWith("RA-05-OBSTRUCTION");

    rerender(
      <PursuitRuntime
        capabilityCheck={() => false}
        completedActionIds={["RA-05-PASSPORT", "RA-05-OBSTRUCTION"]}
        completedStepIds={firstFourSteps}
        onRequestAction={onRequestAction}
        onRequestStep={onRequestStep}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: reconstruction.repairSteps[4]!.actionLabel,
      }),
    );
    expect(onRequestStep).toHaveBeenCalledWith("RS-05-OBSTRUCTION");
  });

  it("renders the same canonical sequence in reduced-motion mode", async () => {
    const user = userEvent.setup();
    const onRequestStep = vi.fn();
    render(
      <ReducedMotionRepair
        completedActionIds={[]}
        completedStepIds={[]}
        onRequestAction={vi.fn()}
        onRequestStep={onRequestStep}
      />,
    );

    for (const step of reconstruction.repairSteps) {
      expect(screen.getByText(step.statement)).toBeInTheDocument();
    }
    expect(screen.getByText(/either order/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: reconstruction.repairSteps[0]!.actionLabel,
      }),
    );
    expect(onRequestStep).toHaveBeenCalledWith("RS-01-ROUTE");
  });
});
