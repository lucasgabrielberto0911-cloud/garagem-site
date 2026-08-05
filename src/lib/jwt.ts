import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getJwtSecret } from "@/lib/secrets";

function getSecretKey() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function signToken(
  payload: JWTPayload,
  expiresIn: string = "7d",
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyToken<T extends JWTPayload = JWTPayload>(
  token: string,
) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload as T;
}
