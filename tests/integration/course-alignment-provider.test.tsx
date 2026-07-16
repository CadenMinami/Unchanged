import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  CourseAlignmentProvider,
  useCourseAlignment,
} from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";

function Harness() {
  const {
    ready,
    draft,
    approvedAlignment,
    preferences,
    setDraft,
    approveDraft,
    updatePreferences,
  } = useCourseAlignment();
  const sample = loadVarennesAlignmentCatalog().sampleProfile;

  return (
    <div>
      <p>{ready ? "ready" : "loading"}</p>
      <p>draft: {draft?.packet.title ?? "none"}</p>
      <p>approved: {approvedAlignment?.profile.packet.title ?? "none"}</p>
      <p>reading: {preferences.readingMode}</p>
      <button type="button" onClick={() => setDraft(sample)}>
        Load draft
      </button>
      <button type="button" onClick={() => draft && approveDraft(draft)}>
        Approve
      </button>
      <button
        type="button"
        onClick={() => updatePreferences({ readingMode: "reduced" })}
      >
        Reduce reading
      </button>
    </div>
  );
}

describe("CourseAlignmentProvider", () => {
  it("keeps drafts unapproved until the teacher confirms them", async () => {
    const user = userEvent.setup();
    render(
      <CourseAlignmentProvider persist={false}>
        <Harness />
      </CourseAlignmentProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Load draft" }));
    expect(screen.getByText(/draft: France in 1791/)).toBeInTheDocument();
    expect(screen.getByText("approved: none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/approved: France in 1791/)).toBeInTheDocument();
  });

  it("shares accessibility preferences even without alignment", async () => {
    const user = userEvent.setup();
    render(
      <CourseAlignmentProvider persist={false}>
        <Harness />
      </CourseAlignmentProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Reduce reading" }));
    expect(screen.getByText("reading: reduced")).toBeInTheDocument();
  });

  it("hydrates persisted preferences", async () => {
    window.localStorage.clear();
    render(
      <CourseAlignmentProvider>
        <Harness />
      </CourseAlignmentProvider>,
    );

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    await act(async () => undefined);
  });
});
