import { createHmac, timingSafeEqual } from "node:crypto";
import { loadConfig } from "../config.js";

interface TokenPayload {
  sub: string;
  typ: "access" | "refresh";
  exp: number;
}

const config = loadConfig();

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function createToken(userId: string, type: TokenPayload["typ"], ttlSeconds: number, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      typ: type,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies TokenPayload),
  );
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: createToken(userId, "access", 15 * 60, config.jwtAccessSecret),
    refreshToken: createToken(userId, "refresh", 30 * 24 * 60 * 60, config.jwtRefreshSecret),
  };
}

export function verifyToken(token: string, type: TokenPayload["typ"]): TokenPayload | undefined {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return undefined;
  }

  const secret = type === "access" ? config.jwtAccessSecret : config.jwtRefreshSecret;
  const expected = sign(`${header}.${payload}`, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return undefined;
  }

  const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;
  if (decoded.typ !== type || decoded.exp < Math.floor(Date.now() / 1000)) {
    return undefined;
  }

  return decoded;
}
