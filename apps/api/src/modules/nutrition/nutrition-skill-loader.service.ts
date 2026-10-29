import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const SKILL_ROOT = resolve(__dirname, "../../../skills/sports-nutrition");
const SKILL_VERSION = "1.1.0-ridepilot.1";
const MAX_FILE_BYTES = 64 * 1024;

@Injectable()
export class NutritionSkillLoaderService {
  async load(
    mode: "INITIAL" | "REGENERATE" | "TRAINING_LINKED" | "RACE_LINKED",
  ) {
    const root = await realpath(SKILL_ROOT);
    const reference =
      mode === "RACE_LINKED"
        ? "references/race-day-and-event-fueling.md"
        : mode === "TRAINING_LINKED"
          ? "references/intra-workout-fueling-and-hydration.md"
          : "references/macronutrient-periodization.md";
    const files = ["SKILL.md", "UPSTREAM.md", reference];
    const contents = await Promise.all(
      files.map((file) => this.read(root, file)),
    );
    const content = contents.join("\n\n");
    return {
      id: "sports-nutrition",
      version: SKILL_VERSION,
      reference,
      content,
      hash: createHash("sha256")
        .update(SKILL_VERSION)
        .update(content)
        .digest("hex"),
    };
  }

  private async read(root: string, file: string) {
    const path = await realpath(resolve(root, file));
    if (!path.startsWith(`${root}${sep}`))
      throw new InternalServerErrorException("Nutrition skill path invalid");
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_FILE_BYTES)
      throw new InternalServerErrorException("Nutrition skill file invalid");
    return readFile(path, "utf8");
  }
}
