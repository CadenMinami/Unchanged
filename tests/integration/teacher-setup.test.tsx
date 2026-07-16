import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { CourseAlignmentProvider } from "@/components/course-alignment/course-alignment-provider";
import { TeacherSetup } from "@/components/teacher/teacher-setup";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";
import {
  COURSE_ALIGNMENT_PROMPT_VERSION,
  COURSE_ALIGNMENT_VERSION,
  type CourseAlignmentProfile,
} from "@/schemas/course-alignment";

const casePackage = loadVarennesCase();
const catalog = loadVarennesAlignmentCatalog();

function renderSetup() {
  return render(
    <CourseAlignmentProvider persist={false}>
      <TeacherSetup />
    </CourseAlignmentProvider>,
  );
}

function alignmentResponse(profile: CourseAlignmentProfile = catalog.sampleProfile) {
  return new Response(
    JSON.stringify({
      status: "ok",
      contractVersion: COURSE_ALIGNMENT_VERSION,
      requestId: "4ea5a03e-1854-40a4-a046-131289ad6a64",
      profile,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("teacher setup workspace", () => {
  it("adds a restrained teacher entry to the case home", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /teacher setup/i })).toHaveAttribute(
      "href",
      "/teacher",
    );
  });

  it("keeps student launch locked until the teacher reviews and approves alignment", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(alignmentResponse());
    vi.stubGlobal("fetch", fetchMock);
    renderSetup();

    expect(screen.getByRole("heading", { name: /prepare this case/i })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /launch student case/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /review sample packet/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ai/course-alignment");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      contractVersion: COURSE_ALIGNMENT_VERSION,
      promptVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
      caseId: casePackage.caseId,
      caseVersion: casePackage.caseVersion,
      catalogVersion: COURSE_ALIGNMENT_VERSION,
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      selectedObjectiveIds: catalog.objectives.map((objective) => objective.id),
      source: { kind: "sample" },
    });

    const review = await screen.findByRole("region", { name: /alignment review/i });
    expect(within(review).getAllByText("Class material").length).toBeGreaterThan(0);
    expect(within(review).getAllByText("Page 1").length).toBeGreaterThan(0);
    expect(
      within(review).getByText(catalog.concepts[0].canonicalDefinition),
    ).toBeInTheDocument();
    expect(
      within(review).getByText(
        catalog.limitations.find(
          (limitation) => limitation.id === "LIMITATION-SAMPLE-MATERIAL",
        )!.message,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /launch student case/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm alignment/i }));

    expect(screen.getByRole("link", { name: /launch student case/i })).toHaveAttribute(
      "href",
      "/play",
    );
    expect(screen.getByText(/approved for this browser session/i)).toBeInTheDocument();
  });

  it("submits pasted text and exposes all three learning preferences", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(alignmentResponse());
    vi.stubGlobal("fetch", fetchMock);
    renderSetup();

    await user.click(screen.getByRole("tab", { name: /paste text/i }));
    await user.type(screen.getByLabelText(/packet title/i), "Unit 3 notes");
    await user.type(
      screen.getByLabelText(/course packet text/i),
      "Compare sources and explain why several conditions worked together.",
    );
    await user.click(screen.getByRole("radio", { name: /reduced reading/i }));
    await user.click(screen.getByRole("radio", { name: /reduced motion/i }));
    await user.click(screen.getByRole("radio", { name: /unit challenge/i }));
    await user.click(screen.getByRole("button", { name: /analyze pasted text/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.source).toEqual({
      kind: "text",
      title: "Unit 3 notes",
      text: "Compare sources and explain why several conditions worked together.",
    });
    expect(screen.getByRole("radio", { name: /reduced reading/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /reduced motion/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /unit challenge/i })).toBeChecked();
  });

  it("reads TXT and Markdown uploads as bounded text requests", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(alignmentResponse());
    vi.stubGlobal("fetch", fetchMock);
    renderSetup();

    await user.click(screen.getByRole("tab", { name: /upload file/i }));
    const input = screen.getByLabelText(/course packet file/i);
    const file = new File(
      ["A source can be useful and partial at the same time."],
      "lesson.md",
      { type: "text/markdown" },
    );
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /analyze uploaded file/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.source).toEqual({
      kind: "file",
      title: "lesson.md",
      filename: "lesson.md",
      mimeType: "text/markdown",
      text: "A source can be useful and partial at the same time.",
    });
    expect(input).toHaveAttribute(
      "accept",
      ".txt,.md,text/plain,text/markdown",
    );
  });

  it("shows an actionable API error and can clear an approved alignment", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(alignmentResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "payload_too_large", message: "The course packet is too large." },
          }),
          { status: 413, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderSetup();

    await user.click(screen.getByRole("button", { name: /review sample packet/i }));
    await user.click(await screen.findByRole("button", { name: /confirm alignment/i }));
    expect(screen.getByRole("link", { name: /launch student case/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear alignment/i }));
    expect(screen.queryByRole("link", { name: /launch student case/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /paste text/i }));
    await user.type(screen.getByLabelText(/packet title/i), "Oversized packet");
    await user.type(screen.getByLabelText(/course packet text/i), "Some course notes");
    await user.click(screen.getByRole("button", { name: /analyze pasted text/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The course packet is too large.",
    );
  });
});
