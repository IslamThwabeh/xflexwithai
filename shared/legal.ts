export const CURRENT_TERMS_VERSION = "v2" as const;

/**
 * Existing, evidenced acceptances remain valid for this rollout. A future
 * legal review can deliberately change this to require the current version.
 */
export type TermsAcceptancePolicy = "any_recorded_version" | "current_version";
export const TERMS_ACCEPTANCE_POLICY: TermsAcceptancePolicy = "any_recorded_version";

export const TERMS_ACCEPTANCE_REQUIRED_ERROR = "TERMS_ACCEPTANCE_REQUIRED";
