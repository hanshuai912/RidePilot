import { SkillLoaderService } from "../src/modules/coach/skill-loader.service";

describe("cycling skill source selection", () => {
  const loader = new SkillLoaderService();

  it("loads the pinned cycling reference and the requested scene", async () => {
    const weekly = await loader.load("weekly-planning");
    const adjustment = await loader.load("adaptive-adjustment");

    expect(weekly.version).toBe("1.1.0");
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
});
