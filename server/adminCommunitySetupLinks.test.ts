import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureCenterSource = readFileSync(
  new URL("../frontend/src/pages/AdminFeatureCenter.tsx", import.meta.url),
  "utf8",
);
const communitySource = readFileSync(
  new URL("../frontend/src/pages/AdminCommunityModeration.tsx", import.meta.url),
  "utf8",
);
const setupCardSource = readFileSync(
  new URL("../frontend/src/components/admin/SafeAdminPreview.tsx", import.meta.url),
  "utf8",
);

describe("admin community setup guidance", () => {
  it("links each community readiness requirement to its exact workspace", () => {
    expect(featureCenterSource).toContain(
      'href: "/admin/roles?feature=student-community"',
    );
    expect(featureCenterSource).toContain(
      'href: "/admin/community?setup=policy"',
    );
    expect(featureCenterSource).toContain(
      'href: "/admin/community?setup=automated-checks"',
    );
    expect(featureCenterSource).toContain("onClick={() => setLocation(item.href!)}");
  });

  it("focuses the policy editor and automated-check guidance from deep links", () => {
    expect(communitySource).toContain('policy: "community-policy-terms"');
    expect(communitySource).toContain(
      '"automated-checks": "community-automated-checks"',
    );
    expect(communitySource).toContain("focusCommunitySetup(initialSetupTarget)");
    expect(communitySource).toContain('href="https://dash.cloudflare.com/"');
    expect(communitySource).toContain("OPENAI_API_KEY");
  });

  it("allows setup cards to carry a direct action without weakening their status copy", () => {
    expect(setupCardSource).toContain("action?: ReactNode");
    expect(setupCardSource).toContain('<div className="mt-2">{item.action}</div>');
  });
});
