import { SkillLoaderService } from "../src/modules/coach/skill-loader.service";

describe("cycling skill source selection", () => {
  const loader = new SkillLoaderService();

  it("loads the pinned cycling reference and the requested scene", async () => {
    const weekly = await loader.load("weekly-planning");
    const adjustment = await loader.load("adaptive-adjustment");

    expect(weekly.version).toBe("1.2.0");
    expect(weekly.content).toContain("FTP-based cycling intensity reference");
    expect(weekly.content).toContain("estruyf");
    expect(weekly.content).not.toContain("tp_create_workout");
    expect(weekly.content).not.toContain("<FreeRide>");
    expect(adjustment.content).toContain("mprecilio20");
    expect(adjustment.content).not.toContain("# Weekly cycling planning");
    expect(adjustment.hash).not.toBe(weekly.hash);
  });

  it("keeps the explanation scene read-only", async () => {
    const explanation = await loader.load("plan-explanation");
    expect(explanation.content).toContain("read-only");
    expect(explanation.content).toContain("confirmation flow");
  });

  it("uses separate stage and range references without the seven-day constraint", async () => {
    const stages = await loader.load("stage-planning");
    const range = await loader.load("range-planning");
    expect(stages.content).toContain("Return a stage roadmap only");
    expect(range.content).toContain("Cover every calendar week");
    expect(range.content).not.toContain("requested seven local dates");
    expect(stages.hash).not.toBe(range.hash);
  });
});
