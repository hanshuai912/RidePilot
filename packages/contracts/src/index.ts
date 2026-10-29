export { healthResponseSchema } from "./health";
export type { HealthResponse } from "./health";
export {
  authResponseSchema,
  authUserSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  tokenPairSchema,
} from "./auth";
export type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from "./auth";
export { profilePatchSchema, profileResponseSchema } from "./profile";
export type { ProfilePatch, ProfileResponse } from "./profile";
export {
  applyProposalResponseSchema,
  applyProposalSchema,
  calendarResponseSchema,
  createManualWorkoutProposalSchema,
  editWorkoutProposalSchema,
  manualWorkoutDraftSchema,
  proposalResponseSchema,
  updateProposalSchema,
  workoutIntensitySchema,
  workoutSegmentSchema,
  workoutSegmentTypeSchema,
  workoutTargetSchema,
} from "./training";
export * from "./coach";
export {
  externalConnectionListSchema,
  externalConnectionSchema,
  integrationAuthorizationResponseSchema,
  integrationProviderListSchema,
  integrationProviderSchema,
} from "./integrations";
export type {
  ExternalConnection,
  IntegrationAuthorizationResponse,
  IntegrationProvider,
} from "./integrations";
export type {
  ApplyProposal,
  ApplyProposalResponse,
  CalendarResponse,
  CreateManualWorkoutProposal,
  EditWorkoutProposal,
  ManualWorkoutDraft,
  ProposalResponse,
  UpdateProposal,
  WorkoutSegment,
} from "./training";
