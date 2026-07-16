import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";

describe("collective detention reconstruction", () => {
  it("requires both local-action edges before guarded detention", () => {
    const casePackage = loadVarennesCase();
    const detentionEdgeIds = casePackage.causalEdges
      .filter((edge) => edge.toNodeId === "NODE-DETENTION")
      .map((edge) => edge.id);

    expect(new Set(detentionEdgeIds)).toEqual(
      new Set(["EDGE-OBSTRUCTION-DETENTION", "EDGE-PASSPORT-DETENTION"]),
    );
    expect(casePackage.solution.requiredCausalEdgeIds).toEqual(
      expect.arrayContaining(detentionEdgeIds),
    );
    expect(
      casePackage.causalEdges
        .filter((edge) => detentionEdgeIds.includes(edge.id))
        .map((edge) => edge.verb),
    ).toEqual(["contributed_to", "contributed_to"]);
  });

  it("does not count the partly overlapping municipal record as independent from Drouet", () => {
    const casePackage = loadVarennesCase();
    const municipalSource = casePackage.sources.find((source) => source.id === "S3");
    const civicDossier = casePackage.evidence.find((evidence) => evidence.id === "E5");

    expect(municipalSource?.historicalLineageEligible).toBe(false);
    expect(civicDossier?.dependencyLineageIds).toContain("L3-VARENNES-MUNICIPAL-RECORD");
    expect(civicDossier?.sourceLineageIds).toEqual(["L2-DROUET-ASSEMBLY-REPORT"]);
  });

  it("models obstruction and inspection as parallel actions rather than a lone cause", () => {
    const reconstruction = loadVarennesReconstruction();
    const localActionStep = reconstruction.repairSteps.find(
      (step) => step.id === "RS-05-OBSTRUCTION",
    ) as (typeof reconstruction.repairSteps)[number] & { requiredActionIds: string[] };
    const detentionStep = reconstruction.repairSteps.find(
      (step) => step.id === "RS-06-DETENTION",
    );

    expect(reconstruction.version).toBe("1.1.0");
    expect(new Set(localActionStep.requiredActionIds)).toEqual(
      new Set(["RA-05-OBSTRUCTION", "RA-05-PASSPORT"]),
    );
    expect(detentionStep?.edgeIds).toEqual(
      expect.arrayContaining(["EDGE-OBSTRUCTION-DETENTION", "EDGE-PASSPORT-DETENTION"]),
    );
    expect(localActionStep.statement).toMatch(/authored reconstruction/i);
    expect(localActionStep.statement).toMatch(/do not prove.*strict but-for cause/i);
    expect(detentionStep?.statement).toMatch(/neither incoming edge.*sole physical arrest/i);
    expect(`${localActionStep.statement} ${detentionStep?.statement}`).not.toMatch(
      /historically necessary|historically sufficient|bridge.*arrested/i,
    );
  });

  it("keeps the pursuit wording inside the approved report and reconstruction limits", () => {
    const reconstruction = loadVarennesReconstruction();
    const pursuitStep = reconstruction.repairSteps.find(
      (step) => step.id === "RS-02-PURSUIT",
    );
    const combinedCopy = reconstruction.repairSteps
      .map((step) => `${step.title} ${step.actionLabel} ${step.statement}`)
      .join(" ");

    expect(pursuitStep?.statement).toMatch(/by side roads toward Varennes/i);
    expect(combinedCopy).not.toMatch(/shorter road|necessary|sufficient|single-handed/i);
    expect(combinedCopy).not.toMatch(/bridge (?:arrested|captured|stopped) (?:the )?(?:king|travelers)/i);
  });
});
