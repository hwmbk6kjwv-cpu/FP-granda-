// senha única da Granda. Guardamos só o hash (scrypt); o cookie de sessão é um HMAC desse hash,
// então trocar a senha derruba todas as sessões antigas.
import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const COOKIE = "granda_auth";
const HASH_INICIAL = "4dea15ce1f159700634609f25c9fc0b6:c75fafeb1d0e7a1e7de37e9a0dda0d30e7f49823734fcddf26d2ada943cf5098";
const cfg = () => getStore({ name: "granda-config", consistency: "strong" });

async function hashAtual(): Promise<string> {
  const v = await cfg().get("senha");
  return v || HASH_INICIAL;
}
const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export async function senhaConfere(senha: string): Promise<boolean> {
  const [salt, h] = (await hashAtual()).split(":");
  const calc = scryptSync(String(senha || ""), salt, 32).toString("hex");
  return igual(calc, h);
}
export async function trocaSenha(nova: string) {
  const salt = randomBytes(16).toString("hex");
  await cfg().set("senha", salt + ":" + scryptSync(nova, salt, 32).toString("hex"));
}
export async function token(): Promise<string> {
  return createHmac("sha256", await hashAtual()).update("granda-ajustes-v1").digest("hex");
}
export async function autorizado(req: Request): Promise<boolean> {
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return false;
  return igual(c.slice(COOKIE.length + 1), await token());
}
export function cookie(valor: string, maxAge: number): string {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export const negado = () => Response.json({ erro: "acesso negado" }, { status: 401 });
