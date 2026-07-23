import {
  invokeOpenAiModeration,
  type OpenAiModerationResponse,
} from "../_core/openai";

export const STUDENT_COMMUNITY_MODERATION_MODEL = "omni-moderation-latest";

export type StudentCommunityModerationOutcome =
  | "allowed"
  | "blocked_policy"
  | "blocked_openai"
  | "error";

export type StudentCommunityModerationReason =
  | "approved"
  | "competitor_reference"
  | "prohibited_language"
  | "openai_flagged"
  | "openai_unavailable";

export type CommunityPolicyTermCategory =
  | "competitor"
  | "prohibited_language";

export type CommunityPolicyTerm = {
  id: number;
  term: string;
  normalizedTerm: string;
  category: CommunityPolicyTermCategory;
};

export type StudentCommunityModerationDecision = {
  outcome: StudentCommunityModerationOutcome;
  reasonCode: StudentCommunityModerationReason;
  model: string | null;
  requestId: string | null;
  flaggedCategories: string[];
  categoryScores: Record<string, number>;
  matchedPolicyTermId: number | null;
  durationMs: number;
};

const HIGH_RISK_COMMUNITY_MODERATION_CATEGORIES = new Set([
  "harassment/threatening",
  "hate/threatening",
  "illicit/violent",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors",
  "violence",
  "violence/graphic",
]);

export function isHighRiskCommunityModerationDecision(
  decision: Pick<StudentCommunityModerationDecision, "flaggedCategories">,
) {
  return decision.flaggedCategories.some(category =>
    HIGH_RISK_COMMUNITY_MODERATION_CATEGORIES.has(category)
  );
}

type ModerationInvoker = (params: {
  input: string;
  model?: string;
  usage: {
    userId?: number | null;
    endpoint?: string | null;
    featureName?: string | null;
    flowType?: string | null;
    actionType?: string | null;
    requestMode?: "vision" | "text" | null;
    metadata?: string | null;
  };
}) => Promise<OpenAiModerationResponse>;

export function normalizeCommunityPolicyText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function findCommunityPolicyMatch(
  content: string,
  policyTerms: CommunityPolicyTerm[],
) {
  const normalizedContent = normalizeCommunityPolicyText(content);
  if (!normalizedContent) return null;
  const boundedContent = ` ${normalizedContent} `;

  for (const policyTerm of policyTerms) {
    const normalizedTerm =
      normalizeCommunityPolicyText(policyTerm.normalizedTerm || policyTerm.term);
    if (normalizedTerm && boundedContent.includes(` ${normalizedTerm} `)) {
      return policyTerm;
    }
  }

  return null;
}

export async function hashStudentCommunityContent(content: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function moderateStudentCommunitySubmission(input: {
  userId: number;
  contentType: "post" | "comment";
  content: string;
  policyTerms: CommunityPolicyTerm[];
  invokeModeration?: ModerationInvoker;
}): Promise<StudentCommunityModerationDecision> {
  const startedAt = Date.now();
  const matchedPolicyTerm = findCommunityPolicyMatch(
    input.content,
    input.policyTerms,
  );
  if (matchedPolicyTerm) {
    return {
      outcome: "blocked_policy",
      reasonCode: matchedPolicyTerm.category === "prohibited_language"
        ? "prohibited_language"
        : "competitor_reference",
      model: null,
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: matchedPolicyTerm.id,
      durationMs: Date.now() - startedAt,
    };
  }

  const invokeModeration = input.invokeModeration ?? invokeOpenAiModeration;
  try {
    const response = await invokeModeration({
      input: input.content,
      model: STUDENT_COMMUNITY_MODERATION_MODEL,
      usage: {
        userId: input.userId,
        endpoint: "/v1/moderations",
        featureName: "student_community",
        flowType: input.contentType,
        actionType: "prepublication_moderation",
        requestMode: "text",
        metadata: JSON.stringify({ contentType: input.contentType }),
      },
    });
    const result = response.results?.[0];
    if (!result) throw new Error("OpenAI moderation returned no result");

    const flaggedCategories = Object.entries(result.categories ?? {})
      .filter(([, flagged]) => flagged === true)
      .map(([category]) => category)
      .sort();

    return {
      outcome: result.flagged ? "blocked_openai" : "allowed",
      reasonCode: result.flagged ? "openai_flagged" : "approved",
      model: response.model ?? STUDENT_COMMUNITY_MODERATION_MODEL,
      requestId: response.id ?? null,
      flaggedCategories,
      categoryScores: result.category_scores ?? {},
      matchedPolicyTermId: null,
      durationMs: Date.now() - startedAt,
    };
  } catch {
    return {
      outcome: "error",
      reasonCode: "openai_unavailable",
      model: STUDENT_COMMUNITY_MODERATION_MODEL,
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: null,
      durationMs: Date.now() - startedAt,
    };
  }
}
