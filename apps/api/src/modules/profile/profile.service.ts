import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProfilePatch, ProfileResponse } from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { ProfileRepository } from "./profile.repository";

@Injectable()
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  async get(userId: string): Promise<ProfileResponse> {
    const user = await this.repository.findByUserId(userId);
    if (!user)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "用户不存在",
      });
    return this.toResponse(user);
  }

  async patch(userId: string, input: ProfilePatch): Promise<ProfileResponse> {
    const current = await this.repository.findByUserId(userId);
    if (!current)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "用户不存在",
      });
    const { expectedVersion, equipmentFlags, ...rest } = input;
    const athlete: Record<string, unknown> = {};
    for (const key of [
      "gender",
      "ageBand",
      "heightCm",
      "weightKg",
      "experienceLevel",
      "trainingPurpose",
      "viewPreference",
    ] as const) {
      if (key in rest) {
        const value = rest[key];
        athlete[key] =
          key === "heightCm" || key === "weightKg"
            ? value === null
              ? null
              : new Prisma.Decimal(value as number)
            : value;
      }
    }
    if (equipmentFlags !== undefined) athlete.equipmentFlags = equipmentFlags;
    const updated = await this.repository.patch(userId, expectedVersion, {
      ...rest,
      profileVersion: current.profileVersion,
      athlete,
    });
    if (!updated)
      throw new ConflictException({
        code: "PROFILE_VERSION_CONFLICT",
        message: "用户信息已被其他请求修改，请重新读取后再提交",
      });
    return this.get(userId);
  }

  private toResponse(
    user: Awaited<ReturnType<ProfileRepository["findByUserId"]>>,
  ): ProfileResponse {
    if (!user)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "用户不存在",
      });
    const credential = user.credentials[0];
    const profile = user.athleteProfile;
    const phone = credential?.loginIdentifier ?? "";
    const masked =
      phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
    const flags = Array.isArray(profile?.equipmentFlags)
      ? profile.equipmentFlags.filter((v): v is string => typeof v === "string")
      : [];
    return {
      userId: user.id,
      displayName: user.displayName ?? "骑行者",
      phoneMasked: masked,
      phoneVerificationStatus: credential?.verificationStatus ?? "UNVERIFIED",
      gender: profile?.gender ?? null,
      ageBand: profile?.ageBand ?? null,
      heightCm: profile?.heightCm ? Number(profile.heightCm) : null,
      weightKg: profile?.weightKg ? Number(profile.weightKg) : null,
      experienceLevel:
        (profile?.experienceLevel as ProfileResponse["experienceLevel"]) ??
        null,
      trainingPurpose: profile?.trainingPurpose ?? null,
      equipmentFlags: flags,
      viewPreference: profile?.viewPreference ?? "SIMPLE",
      timezone: user.timezone,
      locale: user.locale,
      version: user.profileVersion,
    };
  }
}
