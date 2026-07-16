export { CURRENT_TERMS_VERSION } from "@shared/legal";
import { CURRENT_TERMS_VERSION } from "@shared/legal";

export type LegalVersion = "v1" | "v2";

type LegalVersionLinks = {
  label: string;
  publishedAt: string;
  terms: string;
  refund: string;
};

export const LEGAL_VERSION_LINKS: Record<LegalVersion, LegalVersionLinks> = {
  v1: {
    label: "v1 - March 2026",
    publishedAt: "2026-03",
    terms: "/legal/terms-v1.html",
    refund: "/legal/refund-v1.html",
  },
  v2: {
    label: "v2 - June 2026",
    publishedAt: "2026-06",
    terms: "/legal/terms-v2.html",
    refund: "/legal/refund-v2.html",
  },
};

export function getLegalVersionLinks(version: string | null | undefined): LegalVersionLinks {
  if (version === "v2") return LEGAL_VERSION_LINKS.v2;
  return LEGAL_VERSION_LINKS.v1;
}
