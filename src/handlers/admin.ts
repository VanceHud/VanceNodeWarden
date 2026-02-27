import { Env, DEFAULT_DEV_SECRET } from '../types';
import { StorageService } from '../services/storage';
import { errorResponse, htmlResponse, jsonResponse } from '../utils/response';
import { LIMITS } from '../config/limits';
import { createRefreshToken } from '../utils/jwt';
import { getClientIdentifier } from '../services/ratelimit';
import { generateUUID } from '../utils/uuid';
import { renderAdminPageHTML } from '../admin/pageTemplate';
import { isTotpEnabled } from '../utils/totp';
import { getBackupOverview, runBackupNow, updateBackupSettings, validateBackupSettingsPatch } from '../services/backup';

const ADMIN_COOKIE_NAME = 'NW_ADMIN';

interface AdminSessionContext {
  sessionToken: string;
  ip: string;
}

function getAdminToken(env: Env): string | null {
  const token = (env.ADMIN_TOKEN || '').trim();
  return token.length > 0 ? token : null;
}

function isAdminEnabled(env: Env): boolean {
  return !!getAdminToken(env);
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    if (!rawKey) continue;
    const rawValue = rawValueParts.join('=');
    out[rawKey] = decodeURIComponent(rawValue || '');
  }
  return out;
}

function getAdminSessionCookie(request: Request): string | null {
  const token = parseCookies(request.headers.get('Cookie'))[ADMIN_COOKIE_NAME];
  return token || null;
}

function buildAdminCookie(request: Request, token: string, ttlMs: number): string {
  const attrs = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
  ];
  if (new URL(request.url).protocol === 'https:') {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

function buildClearAdminCookie(request: Request): string {
  const attrs = [
    `${ADMIN_COOKIE_NAME}=`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (new URL(request.url).protocol === 'https:') {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

function jwtSecretSafe(env: Env): boolean {
  const secret = (env.JWT_SECRET || '').trim();
  return !!secret && secret !== DEFAULT_DEV_SECRET && secret.length >= LIMITS.auth.jwtSecretMinLength;
}

async function parseLoginToken(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as { token?: string };
    return (body.token || '').trim() || null;
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return String(form.get('token') || '').trim() || null;
  }
  return null;
}

async function authenticateAdminSession(request: Request, env: Env): Promise<AdminSessionContext | null> {
  if (!isAdminEnabled(env)) return null;

  const storage = new StorageService(env.DB);
  const token = getAdminSessionCookie(request);
  if (!token) return null;

  const valid = await storage.hasValidAdminSession(token);
  if (!valid) return null;

  await storage.touchAdminSession(token, LIMITS.admin.sessionTtlMs);
  return {
    sessionToken: token,
    ip: getClientIdentifier(request),
  };
}

async function requireAdminApiSession(request: Request, env: Env): Promise<{ ctx: AdminSessionContext | null; response: Response | null }> {
  const ctx = await authenticateAdminSession(request, env);
  if (!ctx) {
    return { ctx: null, response: errorResponse('Admin authorization required', 401) };
  }
  return { ctx, response: null };
}

async function deauthorizeUser(storage: StorageService, userId: string): Promise<boolean> {
  const user = await storage.getUserById(userId);
  if (!user) return false;

  user.securityStamp = generateUUID();
  user.updatedAt = new Date().toISOString();
  await storage.saveUser(user);
  await storage.deleteRefreshTokensByUser(user.id);
  await storage.deleteTrustedTwoFactorTokensByUser(user.id);
  return true;
}

export async function handleAdminPage(request: Request, env: Env): Promise<Response> {
  void request;
  const authenticated = (await authenticateAdminSession(request, env)) !== null;
  return htmlResponse(renderAdminPageHTML({
    authenticated,
    adminEnabled: isAdminEnabled(env),
  }));
}

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  if (!isAdminEnabled(env)) {
    return errorResponse('Admin is disabled. Please configure ADMIN_TOKEN', 503);
  }

  let inputToken: string | null = null;
  try {
    inputToken = await parseLoginToken(request);
  } catch {
    return errorResponse('Invalid login payload', 400);
  }

  if (!inputToken) {
    return errorResponse('token is required', 400);
  }

  const configToken = getAdminToken(env)!;
  const storage = new StorageService(env.DB);
  const ip = getClientIdentifier(request);

  if (!timingSafeEqual(inputToken, configToken)) {
    await storage.writeAdminAuditLog('admin.login_failed', 'admin', null, ip, {
      reason: 'token_mismatch',
    });
    return errorResponse('Invalid admin token', 401);
  }

  const sessionToken = createRefreshToken();
  await storage.createAdminSession(
    sessionToken,
    ip,
    request.headers.get('User-Agent'),
    LIMITS.admin.sessionTtlMs
  );
  await storage.writeAdminAuditLog('admin.login_success', 'admin', null, ip, null);

  return jsonResponse(
    { success: true },
    200,
    { 'Set-Cookie': buildAdminCookie(request, sessionToken, LIMITS.admin.sessionTtlMs) }
  );
}

export async function handleAdminLogout(request: Request, env: Env): Promise<Response> {
  const storage = new StorageService(env.DB);
  const token = getAdminSessionCookie(request);
  if (token) {
    await storage.deleteAdminSession(token);
  }

  await storage.writeAdminAuditLog('admin.logout', 'admin', null, getClientIdentifier(request), null);
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': buildClearAdminCookie(request),
    },
  });
}

export async function handleAdminOverviewApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const [stats, registered] = await Promise.all([
    storage.getAdminOverviewStats(),
    storage.isRegistered(),
  ]);

  return jsonResponse({
    stats,
    system: {
      registered,
      jwtSecretSafe: jwtSecretSafe(env),
      totpEnabled: isTotpEnabled(env.TOTP_SECRET),
      adminEnabled: isAdminEnabled(env),
      serverVersion: LIMITS.compatibility.bitwardenServerVersion,
    },
  });
}

export async function handleAdminUsersApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const users = await storage.getAdminUsersOverview();
  return jsonResponse({
    data: users,
    object: 'list',
    continuationToken: null,
  });
}

export async function handleAdminDisableUserApi(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const changed = await storage.setUserDisabled(userId, true);
  if (!changed) {
    return errorResponse('User not found', 404);
  }

  await deauthorizeUser(storage, userId);
  await storage.writeAdminAuditLog('admin.user.disable', 'user', userId, auth.ctx!.ip, null);
  return new Response(null, { status: 204 });
}

export async function handleAdminEnableUserApi(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const changed = await storage.setUserDisabled(userId, false);
  if (!changed) {
    return errorResponse('User not found', 404);
  }

  await storage.writeAdminAuditLog('admin.user.enable', 'user', userId, auth.ctx!.ip, null);
  return new Response(null, { status: 204 });
}

export async function handleAdminDeauthUserApi(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const ok = await deauthorizeUser(storage, userId);
  if (!ok) {
    return errorResponse('User not found', 404);
  }

  await storage.writeAdminAuditLog('admin.user.deauth', 'user', userId, auth.ctx!.ip, null);
  return new Response(null, { status: 204 });
}

export async function handleAdminDeleteUserApi(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const storage = new StorageService(env.DB);
  const user = await storage.getUserById(userId);
  if (!user) {
    return errorResponse('User not found', 404);
  }

  const attachmentRefs = await storage.getUserAttachmentRefs(userId);
  for (const item of attachmentRefs) {
    await env.ATTACHMENTS.delete(`${item.cipherId}/${item.attachmentId}`);
  }

  const deleted = await storage.deleteUserById(userId);
  if (!deleted) {
    return errorResponse('User not found', 404);
  }

  await storage.writeAdminAuditLog('admin.user.delete', 'user', userId, auth.ctx!.ip, {
    email: user.email,
    attachmentCount: attachmentRefs.length,
  });
  return new Response(null, { status: 204 });
}

export async function handleAdminAuditLogsApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const parsedLimit = Number.parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, LIMITS.admin.maxAuditRows))
    : 100;

  const storage = new StorageService(env.DB);
  const logs = await storage.getAdminAuditLogs(limit);
  return jsonResponse({
    data: logs,
    object: 'list',
    continuationToken: null,
  });
}

export async function handleAdminBackupApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const overview = await getBackupOverview(env);
  return jsonResponse(overview);
}

export async function handleAdminBackupSettingsApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const validation = validateBackupSettingsPatch(body);
  if (!validation.ok) {
    return errorResponse(validation.message, 400);
  }

  const overview = await updateBackupSettings(env, validation.patch, auth.ctx!.ip);
  return jsonResponse(overview);
}

export async function handleAdminBackupRunApi(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdminApiSession(request, env);
  if (auth.response) return auth.response;

  const result = await runBackupNow(env, auth.ctx!.ip);
  if (result.status === 'success') {
    return jsonResponse(result, 200);
  }

  if (result.status === 'skipped') {
    return jsonResponse(result, 409);
  }

  return jsonResponse(result, 500);
}
