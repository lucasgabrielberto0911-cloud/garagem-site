import { SignJWT, jwtVerify, type JWTPayload } from "jose";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return new TextEncoder().encode(secret);
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
