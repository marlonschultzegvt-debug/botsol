/**
 * Cliente da API do Instagram (Instagram API with Instagram Login / Business Login).
 * Docs: developers.facebook.com/documentation/instagram-platform
 *
 * Fluxo de publicação (2 fases):
 *   1. POST /{ig-user}/media            → cria o contêiner com a URL pública da mídia
 *   2. GET  /{container}?fields=status_code  até FINISHED (vídeo pode levar minutos)
 *   3. POST /{ig-user}/media_publish     → publica e devolve o ID do post
 */
import "server-only";

// Endereços da Meta (sobrescrevíveis só para testes automatizados com um simulador local).
const GRAPH = process.env.IG_GRAPH_BASE ?? "https://graph.instagram.com";
const OAUTH_TOKEN_URL = process.env.IG_OAUTH_TOKEN_URL ?? "https://api.instagram.com/oauth/access_token";
const AUTHORIZE_URL = process.env.IG_AUTHORIZE_URL ?? "https://www.instagram.com/oauth/authorize";
export const IG_API_VERSION = process.env.INSTAGRAM_API_VERSION ?? "v27.0";
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export const igConfigured = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);

/** URL de retorno do login. Tem que estar IGUAL no painel da Meta. */
export const igRedirectUri = (origin: string) =>
  process.env.INSTAGRAM_REDIRECT_URI ?? `${process.env.APP_URL ?? origin}/api/instagram/callback`;

export class InstagramError extends Error {
  constructor(message: string, public code?: number | string, public transient = false) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const err = (json.error ?? (json.error_type ? json : null)) as
    | { message?: string; error_message?: string; code?: number; is_transient?: boolean; error_user_msg?: string }
    | null;
  if (!res.ok || err) {
    const msg = err?.error_user_msg || err?.message || err?.error_message || `Instagram respondeu ${res.status}`;
    throw new InstagramError(msg, err?.code ?? res.status, Boolean(err?.is_transient) || res.status >= 500);
  }
  return json as T;
}

// ─────────────────────────────── Login ───────────────────────────────────────

export function authorizeUrl(state: string, redirectUri: string) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

/** Código → token curto → token longo (60 dias). */
export async function exchangeCode(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: code.replace(/#_$/, ""),
  });
  // A resposta pode vir "achatada" ou dentro de data[0], conforme a versão.
  const r = await call<{ access_token?: string; user_id?: string | number; data?: { access_token: string; user_id: string | number }[] }>(
    OAUTH_TOKEN_URL,
    { method: "POST", body: form },
  );
  const short = r.access_token ?? r.data?.[0]?.access_token;
  if (!short) throw new InstagramError("A Meta não devolveu o token de acesso.");

  const long = await call<{ access_token: string; expires_in: number }>(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.INSTAGRAM_APP_SECRET!)}&access_token=${encodeURIComponent(short)}`,
  );
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000) };
}

/** Renova o token longo por mais 60 dias (precisa ter pelo menos 24h de vida). */
export async function refreshToken(token: string) {
  const r = await call<{ access_token: string; expires_in: number }>(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}

export async function getProfile(token: string) {
  return call<{ user_id: string; username: string; account_type?: string; profile_picture_url?: string }>(
    `${GRAPH}/${IG_API_VERSION}/me?fields=user_id,username,account_type,profile_picture_url&access_token=${encodeURIComponent(token)}`,
  );
}

// ─────────────────────────────── Publicação ──────────────────────────────────

type ContainerParams = {
  media_type?: "REELS" | "STORIES" | "CAROUSEL" | "VIDEO";
  image_url?: string;
  video_url?: string;
  caption?: string;
  is_carousel_item?: boolean;
  children?: string;
};

export async function createContainer(igUserId: string, token: string, params: ContainerParams) {
  const r = await call<{ id: string }>(`${GRAPH}/${IG_API_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  return r.id;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

export async function containerStatus(containerId: string, token: string) {
  const r = await call<{ status_code: ContainerStatus; status?: string }>(
    `${GRAPH}/${IG_API_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
  );
  return r;
}

export async function publishContainer(igUserId: string, token: string, creationId: string) {
  const r = await call<{ id: string }>(`${GRAPH}/${IG_API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ creation_id: creationId }),
  });
  return r.id;
}

export async function mediaPermalink(mediaId: string, token: string) {
  const r = await call<{ permalink?: string }>(
    `${GRAPH}/${IG_API_VERSION}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
  ).catch(() => ({ permalink: undefined }));
  return r.permalink ?? null;
}
