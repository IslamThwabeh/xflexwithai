import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const AUDIENCE = "xflex-live-package-recording";

const getSecretKey = () => {
  if (!ENV.jwtSecret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(ENV.jwtSecret);
};

export async function generateLiveRecordingPlaybackToken(recordingId: number) {
  return new SignJWT({ kind: "live_package_recording", recordingId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(getSecretKey());
}

export async function verifyLiveRecordingPlaybackToken(token: string, recordingId: number) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { audience: AUDIENCE });
    return payload.kind === "live_package_recording" && payload.recordingId === recordingId;
  } catch {
    return false;
  }
}
