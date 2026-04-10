import { parse } from "tldts";

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_LABEL_REGEX = /^[a-z0-9-]+$/i;

function hasValidDomainLabels(domainPart: string): boolean {
  const labels = domainPart.split(".");
  if (labels.length < 2) {
    return false;
  }

  return labels.every(label => {
    return Boolean(
      label &&
      label.length <= 63 &&
      !label.startsWith("-") &&
      !label.endsWith("-") &&
      DOMAIN_LABEL_REGEX.test(label)
    );
  });
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isLikelyValidEmail(email: string): boolean {
  const normalizedEmail = normalizeEmailAddress(email);
  if (normalizedEmail.length > 254 || !BASIC_EMAIL_REGEX.test(normalizedEmail)) {
    return false;
  }

  const [localPart, domainPart] = normalizedEmail.split("@");
  if (!localPart || !domainPart || localPart.length > 64) {
    return false;
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domainPart.startsWith(".") ||
    domainPart.endsWith(".") ||
    domainPart.includes("..")
  ) {
    return false;
  }

  if (!hasValidDomainLabels(domainPart)) {
    return false;
  }

  const parsedDomain = parse(domainPart);
  return Boolean(parsedDomain.domain && parsedDomain.publicSuffix && parsedDomain.isIcann);
}