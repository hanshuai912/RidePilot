import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const SKILL_ROOT = resolve(__dirname, "../../../skills/cycling-training");
const MAX_FILE_BYTES = 32 * 1024;
const SKILL_VERSION = "1.1.0";

@Injectable()
export class SkillLoaderService {
  async load(
    reference:
      | "weekly-planning"
      | "adaptive-adjustment"
      | "assessment-review"
      | "race-preparation"
      | "plan-explanation",
  ) {
    const root = await realpath(SKILL_ROOT);
    const files = [
      "SKILL.md",
      "references/power-zones.md",
      `references/${reference}.md`,
    ];
    const contents = await Promise.all(
      files.map((file) => this.readSkillFile(root, file)),
    );
    const manifest = await this.readSkillFile(root, "UPSTREAM.md");
    const content = contents.join("\n\n");
    return {
      id: "cycling-training",
      version: SKILL_VERSION,
      content,
      hash: createHash("sha256")
        .update(SKILL_VERSION)
        .update(manifest)
        .update(content)
        .digest("hex"),
    };
  }

  private async readSkillFile(root: string, file: string) {
    const path = await realpath(resolve(root, file));
    if (!path.startsWith(`${root}${sep}`))
      throw new InternalServerErrorException("Skill path invalid");
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_FILE_BYTES)
      throw new InternalServerErrorException("Skill file invalid");
    return readFile(path, "utf8");
  }
}
