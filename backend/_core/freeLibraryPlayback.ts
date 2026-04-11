import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const FREE_LIBRARY_VIDEO_AUDIENCE = "xflex-free-library-video";

const getSecretKey = () => {
  const secret = ENV.jwtSecret;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
};

export async function generateFreeVideoPlaybackToken(slug: string) {
  return new SignJWT({ kind: "free_library_video", slug })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(FREE_LIBRARY_VIDEO_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(getSecretKey());
}

export async function verifyFreeVideoPlaybackToken(token: string, slug: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      audience: FREE_LIBRARY_VIDEO_AUDIENCE,
    });

    return payload.kind === "free_library_video" && payload.slug === slug;
  } catch {
    return false;
  }
}