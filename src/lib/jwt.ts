import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getJwtSecret } from "@/lib/secrets";

async function getSecretKey() {
  return getJwtSecret();
}

export async function signToken(
  payload: JWTPayload,
  expiresIn: string = "7d",
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(await getSecretKey());
}

export async function verifyToken<T extends JWTPayload = JWTPayload>(
  token: string,
) {
  const { payload } = await jwtVerify(token, await getSecretKey());
  return payload as T;
}
