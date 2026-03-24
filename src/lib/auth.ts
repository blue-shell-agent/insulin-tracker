import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function signToken(payload: { sub: number; email: string; role: string }) {
  return new SignJWT({ ...payload, sub: String(payload.sub) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return { sub: Number(payload.sub), email: payload.email as string, role: payload.role as string };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
