import { LIMITS } from '../config/limits';
import { generateUUID } from '../utils/uuid';
import { Env } from '../types';
import { StorageService } from './storage';

const BACKUP_SETTINGS_KEY = 'backup.settings';
const BACKUP_STATE_KEY = 'backup.state';
const BACKUP_LEASE_KEY = 'backup.lease';

const textEncoder = new TextEncoder();

export type BackupProviderType = 'webdav' | 's3';
export type BackupRunReason = 'manual' | 'scheduled';
export type BackupRunStatus = 'success' | 'failure';

export interface BackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  provider: BackupProviderType;
  pathPrefix: string | null;
}

export interface BackupState {
  lastRunAt: string | null;
  lastRunReason: BackupRunReason | null;
  lastStatus: BackupRunStatus | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  lastProvider: BackupProviderType | null;
  lastFileName: string | null;
  lastLocation: string | null;
  lastSizeBytes: number | null;
  lastAttachmentCount: number | null;
  lastAttachmentBytes: number | null;
  lastDurationMs: number | null;
}

export interface BackupSettingsPatch {
  enabled?: boolean;
  intervalMinutes?: number;
  provider?: BackupProviderType;
  pathPrefix?: string | null;
}

export interface BackupOverview {
  settings: BackupSettings;
  state: BackupState;
  status: {
    isDue: boolean;
    nextDueAt: string | null;
    isRunning: boolean;
    providerConfigured: boolean;
    providerMissingEnv: string[];
  };
}

export interface BackupRunResult {
  status: 'success' | 'failure' | 'skipped';
  reason: BackupRunReason;
  skipReason?: string;
  settings: BackupSettings;
  state: BackupState;
}

interface BackupLease {
  leaseId: string;
  acquiredAtMs: number;
  expiresAtMs: number;
  reason: BackupRunReason;
}

interface AcquiredLease {
  lease: BackupLease;
  serialized: string;
}

interface BackupTableDump {
  name: string;
  createSql: string | null;
  rowCount: number;
  rows: Record<string, unknown>[];
}

interface BackupPayload {
  kind: 'nodewarden.d1.backup';
  version: 1;
  generatedAt: string;
  tables: BackupTableDump[];
}

interface BackupAttachmentRef {
  cipherId: string;
  attachmentId: string;
  fileName: string;
  size: number;
}

interface BackupManifest {
  kind: 'nodewarden.backup.manifest';
  version: 1;
  generatedAt: string;
  provider: BackupProviderType;
  reason: BackupRunReason;
  database: {
    objectKey: string;
    sizeBytes: number;
  };
  attachments: {
    objectPrefix: string;
    count: number;
    totalBytes: number;
  };
}

interface BackupUploadInput {
  objectKey: string;
  contentType: string;
  body: Uint8Array;
}

interface BackupUploadResult {
  provider: BackupProviderType;
  location: string;
}

interface BackupProvider {
  readonly type: BackupProviderType;
  missingEnv(env: Env): string[];
  upload(env: Env, input: BackupUploadInput): Promise<BackupUploadResult>;
}

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: false,
  intervalMinutes: LIMITS.backup.defaultIntervalMinutes,
  provider: 'webdav',
  pathPrefix: null,
};

const DEFAULT_BACKUP_STATE: BackupState = {
  lastRunAt: null,
  lastRunReason: null,
  lastStatus: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  lastProvider: null,
  lastFileName: null,
  lastLocation: null,
  lastSizeBytes: null,
  lastAttachmentCount: null,
  lastAttachmentBytes: null,
  lastDurationMs: null,
};

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function normalizePathPrefix(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const collapsed = trimmed
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!collapsed) return null;
  if (collapsed.length > LIMITS.backup.maxPathPrefixLength) {
    return collapsed.slice(0, LIMITS.backup.maxPathPrefixLength);
  }

  return collapsed;
}

function parseBackupProvider(value: unknown): BackupProviderType {
  return value === 's3' ? 's3' : 'webdav';
}

function clampIntervalMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return LIMITS.backup.defaultIntervalMinutes;
  }
  const rounded = Math.floor(value);
  return Math.max(LIMITS.backup.minIntervalMinutes, Math.min(LIMITS.backup.maxIntervalMinutes, rounded));
}

function parseBackupSettings(rawValue: string | null): BackupSettings {
  if (!rawValue) {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_BACKUP_SETTINGS };
    }

    const record = parsed as Record<string, unknown>;
    return {
      enabled: record.enabled === true,
      intervalMinutes: clampIntervalMinutes(record.intervalMinutes),
      provider: parseBackupProvider(record.provider),
      pathPrefix: normalizePathPrefix(record.pathPrefix),
    };
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
}

function parseBackupState(rawValue: string | null): BackupState {
  if (!rawValue) {
    return { ...DEFAULT_BACKUP_STATE };
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_BACKUP_STATE };
    }

    const record = parsed as Record<string, unknown>;
    const statusValue = record.lastStatus;
    const reasonValue = record.lastRunReason;
    const providerValue = record.lastProvider;

    return {
      lastRunAt: typeof record.lastRunAt === 'string' ? record.lastRunAt : null,
      lastRunReason: reasonValue === 'manual' || reasonValue === 'scheduled' ? reasonValue : null,
      lastStatus: statusValue === 'success' || statusValue === 'failure' ? statusValue : null,
      lastSuccessAt: typeof record.lastSuccessAt === 'string' ? record.lastSuccessAt : null,
      lastFailureAt: typeof record.lastFailureAt === 'string' ? record.lastFailureAt : null,
      lastError: typeof record.lastError === 'string' ? record.lastError : null,
      lastProvider: providerValue === 'webdav' || providerValue === 's3' ? providerValue : null,
      lastFileName: typeof record.lastFileName === 'string' ? record.lastFileName : null,
      lastLocation: typeof record.lastLocation === 'string' ? record.lastLocation : null,
      lastSizeBytes: typeof record.lastSizeBytes === 'number' && Number.isFinite(record.lastSizeBytes) ? record.lastSizeBytes : null,
      lastAttachmentCount: typeof record.lastAttachmentCount === 'number' && Number.isFinite(record.lastAttachmentCount)
        ? record.lastAttachmentCount
        : null,
      lastAttachmentBytes: typeof record.lastAttachmentBytes === 'number' && Number.isFinite(record.lastAttachmentBytes)
        ? record.lastAttachmentBytes
        : null,
      lastDurationMs: typeof record.lastDurationMs === 'number' && Number.isFinite(record.lastDurationMs) ? record.lastDurationMs : null,
    };
  } catch {
    return { ...DEFAULT_BACKUP_STATE };
  }
}

function parseBackupLease(rawValue: string): BackupLease | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.leaseId !== 'string') return null;
    if (typeof record.acquiredAtMs !== 'number' || !Number.isFinite(record.acquiredAtMs)) return null;
    if (typeof record.expiresAtMs !== 'number' || !Number.isFinite(record.expiresAtMs)) return null;
    if (record.reason !== 'manual' && record.reason !== 'scheduled') return null;

    return {
      leaseId: record.leaseId,
      acquiredAtMs: record.acquiredAtMs,
      expiresAtMs: record.expiresAtMs,
      reason: record.reason,
    };
  } catch {
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function snapshotFolderFromTimestamp(nowIso: string): string {
  const safeTs = nowIso.replace(/[:.]/g, '-');
  return `nodewarden-backup-${safeTs}`;
}

function toObjectKey(pathPrefix: string | null, fileName: string): string {
  const normalizedPrefix = normalizePathPrefix(pathPrefix);
  return normalizedPrefix ? `${normalizedPrefix}/${fileName}` : fileName;
}

function ensureWithinTimeout(startedMs: number, stage: string): void {
  if ((Date.now() - startedMs) > LIMITS.backup.runTimeoutMs) {
    throw new Error(`Backup run exceeded timeout during ${stage}`);
  }
}

function safeTableName(tableName: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error(`Unsafe table name in sqlite_master: ${tableName}`);
  }
  return tableName;
}

function isDueNow(settings: BackupSettings, state: BackupState, nowMs: number): { isDue: boolean; nextDueAt: string | null } {
  if (!settings.enabled) {
    return { isDue: false, nextDueAt: null };
  }

  if (!state.lastRunAt) {
    return { isDue: true, nextDueAt: new Date(nowMs).toISOString() };
  }

  const lastRunMs = Date.parse(state.lastRunAt);
  if (!Number.isFinite(lastRunMs)) {
    return { isDue: true, nextDueAt: new Date(nowMs).toISOString() };
  }

  const nextDueMs = lastRunMs + settings.intervalMinutes * 60 * 1000;
  return {
    isDue: nowMs >= nextDueMs,
    nextDueAt: new Date(nextDueMs).toISOString(),
  };
}

export function validateBackupSettingsPatch(input: unknown): { ok: true; patch: BackupSettingsPatch } | { ok: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'JSON object is required' };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(['enabled', 'intervalMinutes', 'provider', 'pathPrefix']);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `Unsupported field: ${key}` };
    }
  }

  const patch: BackupSettingsPatch = {};

  if ('enabled' in record) {
    if (typeof record.enabled !== 'boolean') {
      return { ok: false, message: 'enabled must be boolean' };
    }
    patch.enabled = record.enabled;
  }

  if ('intervalMinutes' in record) {
    if (typeof record.intervalMinutes !== 'number' || !Number.isFinite(record.intervalMinutes)) {
      return { ok: false, message: 'intervalMinutes must be a number' };
    }
    const value = Math.floor(record.intervalMinutes);
    if (value < LIMITS.backup.minIntervalMinutes || value > LIMITS.backup.maxIntervalMinutes) {
      return {
        ok: false,
        message: `intervalMinutes must be between ${LIMITS.backup.minIntervalMinutes} and ${LIMITS.backup.maxIntervalMinutes}`,
      };
    }
    patch.intervalMinutes = value;
  }

  if ('provider' in record) {
    if (record.provider !== 'webdav' && record.provider !== 's3') {
      return { ok: false, message: 'provider must be "webdav" or "s3"' };
    }
    patch.provider = record.provider;
  }

  if ('pathPrefix' in record) {
    if (record.pathPrefix === null) {
      patch.pathPrefix = null;
    } else if (typeof record.pathPrefix === 'string') {
      const normalized = normalizePathPrefix(record.pathPrefix);
      if (normalized && /(^|\/)\.\.(\/|$)/.test(normalized)) {
        return { ok: false, message: 'pathPrefix cannot contain parent directory segments' };
      }
      patch.pathPrefix = normalized;
    } else {
      return { ok: false, message: 'pathPrefix must be string or null' };
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, message: 'No backup settings fields provided' };
  }

  return { ok: true, patch };
}

async function loadBackupSettings(storage: StorageService): Promise<BackupSettings> {
  const raw = await storage.getConfigValue(BACKUP_SETTINGS_KEY);
  return parseBackupSettings(raw);
}

async function saveBackupSettings(storage: StorageService, settings: BackupSettings): Promise<void> {
  await storage.setConfigValue(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
}

async function loadBackupState(storage: StorageService): Promise<BackupState> {
  const raw = await storage.getConfigValue(BACKUP_STATE_KEY);
  return parseBackupState(raw);
}

async function saveBackupState(storage: StorageService, state: BackupState): Promise<void> {
  await storage.setConfigValue(BACKUP_STATE_KEY, JSON.stringify(state));
}

async function getLeaseStatus(storage: StorageService, nowMs: number): Promise<boolean> {
  const raw = await storage.getConfigValue(BACKUP_LEASE_KEY);
  if (!raw) return false;

  const parsed = parseBackupLease(raw);
  if (parsed && parsed.expiresAtMs > nowMs) {
    return true;
  }

  const latest = await storage.getConfigValue(BACKUP_LEASE_KEY);
  if (latest === raw) {
    await storage.deleteConfigValue(BACKUP_LEASE_KEY);
  }
  return false;
}

async function acquireBackupLease(storage: StorageService, reason: BackupRunReason): Promise<AcquiredLease | null> {
  const nowMs = Date.now();
  const lease: BackupLease = {
    leaseId: generateUUID(),
    acquiredAtMs: nowMs,
    expiresAtMs: nowMs + LIMITS.backup.leaseTtlMs,
    reason,
  };

  const serialized = JSON.stringify(lease);
  const inserted = await storage.insertConfigValueIfAbsent(BACKUP_LEASE_KEY, serialized);
  if (inserted) {
    return { lease, serialized };
  }

  const currentRaw = await storage.getConfigValue(BACKUP_LEASE_KEY);
  if (!currentRaw) {
    const retryInserted = await storage.insertConfigValueIfAbsent(BACKUP_LEASE_KEY, serialized);
    if (retryInserted) {
      return { lease, serialized };
    }
    return null;
  }

  const currentLease = parseBackupLease(currentRaw);
  if (currentLease && currentLease.expiresAtMs > nowMs) {
    return null;
  }

  const swapped = await storage.updateConfigValueIfMatch(BACKUP_LEASE_KEY, currentRaw, serialized);
  if (!swapped) {
    return null;
  }

  return { lease, serialized };
}

async function releaseBackupLease(storage: StorageService, acquiredLease: AcquiredLease): Promise<void> {
  const current = await storage.getConfigValue(BACKUP_LEASE_KEY);
  if (current === acquiredLease.serialized) {
    await storage.deleteConfigValue(BACKUP_LEASE_KEY);
  }
}

async function buildBackupPayload(env: Env): Promise<Uint8Array> {
  const tableMetaResult = await env.DB
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all<{ name: string; sql: string | null }>();

  const tables: BackupTableDump[] = [];
  for (const meta of tableMetaResult.results || []) {
    const tableName = safeTableName(meta.name);
    const rowsResult = await env.DB.prepare(`SELECT * FROM \"${tableName}\"`).all<Record<string, unknown>>();
    const rows = rowsResult.results || [];
    tables.push({
      name: tableName,
      createSql: meta.sql,
      rowCount: rows.length,
      rows,
    });
  }

  const payload: BackupPayload = {
    kind: 'nodewarden.d1.backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    tables,
  };

  const serialized = textEncoder.encode(JSON.stringify(payload));
  if (serialized.byteLength > LIMITS.backup.maxPayloadBytes) {
    throw new Error(`Backup payload exceeds limit (${serialized.byteLength} > ${LIMITS.backup.maxPayloadBytes})`);
  }
  return serialized;
}

async function listAttachmentRefs(env: Env): Promise<BackupAttachmentRef[]> {
  const result = await env.DB
    .prepare('SELECT id AS attachment_id, cipher_id, file_name, size FROM attachments ORDER BY cipher_id, id')
    .all<{ attachment_id: string; cipher_id: string; file_name: string; size: number }>();

  return (result.results || []).map((row) => ({
    cipherId: row.cipher_id,
    attachmentId: row.attachment_id,
    fileName: row.file_name,
    size: Number(row.size ?? 0),
  }));
}

async function uploadAttachmentBlobs(
  env: Env,
  provider: BackupProvider,
  snapshotPrefix: string,
  refs: BackupAttachmentRef[],
  startedMs: number
): Promise<{ count: number; totalBytes: number }> {
  let count = 0;
  let totalBytes = 0;

  for (const ref of refs) {
    ensureWithinTimeout(startedMs, 'attachment upload');

    const sourceObjectKey = `${ref.cipherId}/${ref.attachmentId}`;
    const sourceObject = await env.ATTACHMENTS.get(sourceObjectKey);
    if (!sourceObject) {
      throw new Error(`Attachment object not found in R2: ${sourceObjectKey}`);
    }

    const contentType = sourceObject.httpMetadata?.contentType || 'application/octet-stream';
    const body = new Uint8Array(await sourceObject.arrayBuffer());
    const attachmentObjectKey = `${snapshotPrefix}/attachments/${ref.cipherId}/${ref.attachmentId}`;

    await provider.upload(env, {
      objectKey: attachmentObjectKey,
      contentType,
      body,
    });

    count += 1;
    totalBytes += body.byteLength;
  }

  return { count, totalBytes };
}

function buildBackupManifestPayload(
  provider: BackupProviderType,
  reason: BackupRunReason,
  databaseObjectKey: string,
  databaseSizeBytes: number,
  attachmentsPrefix: string,
  attachmentCount: number,
  attachmentTotalBytes: number
): Uint8Array {
  const manifest: BackupManifest = {
    kind: 'nodewarden.backup.manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    provider,
    reason,
    database: {
      objectKey: databaseObjectKey,
      sizeBytes: databaseSizeBytes,
    },
    attachments: {
      objectPrefix: attachmentsPrefix,
      count: attachmentCount,
      totalBytes: attachmentTotalBytes,
    },
  };

  return textEncoder.encode(JSON.stringify(manifest));
}

function concatUrlPath(baseUrl: string, relativePath: string): string {
  const parsed = new URL(baseUrl);
  const baseSegments = parsed.pathname.split('/').filter(Boolean);
  const relSegments = relativePath.split('/').filter(Boolean);
  const allSegments = [...baseSegments, ...relSegments].map(encodeRfc3986);
  parsed.pathname = `/${allSegments.join('/')}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function base64Utf8(value: string): string {
  const bytes = textEncoder.encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

class WebDavBackupProvider implements BackupProvider {
  readonly type: BackupProviderType = 'webdav';

  missingEnv(env: Env): string[] {
    const missing: string[] = [];
    if (!env.BACKUP_WEBDAV_URL || !env.BACKUP_WEBDAV_URL.trim()) missing.push('BACKUP_WEBDAV_URL');
    if (!env.BACKUP_WEBDAV_USERNAME || !env.BACKUP_WEBDAV_USERNAME.trim()) missing.push('BACKUP_WEBDAV_USERNAME');
    if (!env.BACKUP_WEBDAV_PASSWORD || !env.BACKUP_WEBDAV_PASSWORD.trim()) missing.push('BACKUP_WEBDAV_PASSWORD');
    return missing;
  }

  async upload(env: Env, input: BackupUploadInput): Promise<BackupUploadResult> {
    const baseUrl = env.BACKUP_WEBDAV_URL!.trim();
    const username = env.BACKUP_WEBDAV_USERNAME!.trim();
    const password = env.BACKUP_WEBDAV_PASSWORD!;

    const authHeader = `Basic ${base64Utf8(`${username}:${password}`)}`;
    const pathSegments = input.objectKey.split('/').filter(Boolean);
    const fileName = pathSegments[pathSegments.length - 1];
    const directorySegments = pathSegments.slice(0, -1);

    let currentPath = '';
    for (const segment of directorySegments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const mkcolUrl = concatUrlPath(baseUrl, currentPath);
      const mkcolResponse = await fetch(mkcolUrl, {
        method: 'MKCOL',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!(mkcolResponse.ok || mkcolResponse.status === 405 || mkcolResponse.status === 301 || mkcolResponse.status === 302)) {
        throw new Error(`WebDAV MKCOL failed (${mkcolResponse.status})`);
      }
    }

    const filePath = directorySegments.length > 0 ? `${directorySegments.join('/')}/${fileName}` : fileName;
    const uploadUrl = concatUrlPath(baseUrl, filePath);

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': input.contentType,
      },
      body: input.body,
    });

    if (!putResponse.ok) {
      throw new Error(`WebDAV upload failed (${putResponse.status})`);
    }

    return {
      provider: 'webdav',
      location: uploadUrl,
    };
  }
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(data));
  return new Uint8Array(signature);
}

function toAmzDate(now: Date): { dateStamp: string; amzDate: string } {
  const iso = now.toISOString();
  const amzDate = iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return {
    dateStamp: amzDate.slice(0, 8),
    amzDate,
  };
}

class S3BackupProvider implements BackupProvider {
  readonly type: BackupProviderType = 's3';

  missingEnv(env: Env): string[] {
    const missing: string[] = [];
    if (!env.BACKUP_S3_ENDPOINT || !env.BACKUP_S3_ENDPOINT.trim()) missing.push('BACKUP_S3_ENDPOINT');
    if (!env.BACKUP_S3_REGION || !env.BACKUP_S3_REGION.trim()) missing.push('BACKUP_S3_REGION');
    if (!env.BACKUP_S3_BUCKET || !env.BACKUP_S3_BUCKET.trim()) missing.push('BACKUP_S3_BUCKET');
    if (!env.BACKUP_S3_ACCESS_KEY_ID || !env.BACKUP_S3_ACCESS_KEY_ID.trim()) missing.push('BACKUP_S3_ACCESS_KEY_ID');
    if (!env.BACKUP_S3_SECRET_ACCESS_KEY || !env.BACKUP_S3_SECRET_ACCESS_KEY.trim()) missing.push('BACKUP_S3_SECRET_ACCESS_KEY');
    return missing;
  }

  async upload(env: Env, input: BackupUploadInput): Promise<BackupUploadResult> {
    const endpoint = new URL(env.BACKUP_S3_ENDPOINT!.trim());
    const region = env.BACKUP_S3_REGION!.trim();
    const bucket = env.BACKUP_S3_BUCKET!.trim();
    const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID!.trim();
    const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY!;
    const sessionToken = env.BACKUP_S3_SESSION_TOKEN?.trim() || null;

    const forcePathStyle = parseBooleanEnv(env.BACKUP_S3_FORCE_PATH_STYLE);
    const baseSegments = endpoint.pathname.split('/').filter(Boolean);
    const keySegments = input.objectKey.split('/').filter(Boolean);

    let host = endpoint.host;
    const pathSegments = [...baseSegments];

    if (forcePathStyle) {
      pathSegments.push(bucket);
    } else {
      host = `${bucket}.${host}`;
    }
    pathSegments.push(...keySegments);

    const canonicalUri = `/${pathSegments.map(encodeRfc3986).join('/')}`;
    const requestUrl = `${endpoint.protocol}//${host}${canonicalUri}`;

    const payloadHash = await sha256Hex(input.body);
    const now = new Date();
    const { dateStamp, amzDate } = toAmzDate(now);
    const scope = `${dateStamp}/${region}/s3/aws4_request`;

    const canonicalHeaderEntries: Array<[string, string]> = [
      ['content-type', input.contentType],
      ['host', host],
      ['x-amz-content-sha256', payloadHash],
      ['x-amz-date', amzDate],
    ];
    if (sessionToken) {
      canonicalHeaderEntries.push(['x-amz-security-token', sessionToken]);
    }
    canonicalHeaderEntries.sort((a, b) => a[0].localeCompare(b[0]));

    const canonicalHeaders = canonicalHeaderEntries
      .map(([key, value]) => `${key}:${value.trim()}\n`)
      .join('');
    const signedHeaders = canonicalHeaderEntries.map(([key]) => key).join(';');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = await hmacSha256(textEncoder.encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, 's3');
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signature = toHex(await hmacSha256(kSigning, stringToSign));

    const authorizationHeader =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = new Headers();
    headers.set('Authorization', authorizationHeader);
    headers.set('Content-Type', input.contentType);
    headers.set('X-Amz-Content-Sha256', payloadHash);
    headers.set('X-Amz-Date', amzDate);
    if (sessionToken) {
      headers.set('X-Amz-Security-Token', sessionToken);
    }

    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers,
      body: input.body,
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed (${response.status})`);
    }

    return {
      provider: 's3',
      location: `s3://${bucket}/${input.objectKey}`,
    };
  }
}

const backupProviders: Record<BackupProviderType, BackupProvider> = {
  webdav: new WebDavBackupProvider(),
  s3: new S3BackupProvider(),
};

function providerStatus(env: Env, providerType: BackupProviderType): { configured: boolean; missingEnv: string[] } {
  const provider = backupProviders[providerType];
  const missingEnv = provider.missingEnv(env);
  return {
    configured: missingEnv.length === 0,
    missingEnv,
  };
}

async function buildOverview(storage: StorageService, env: Env): Promise<BackupOverview> {
  const nowMs = Date.now();
  const [settings, state, isRunning] = await Promise.all([
    loadBackupSettings(storage),
    loadBackupState(storage),
    getLeaseStatus(storage, nowMs),
  ]);

  const due = isDueNow(settings, state, nowMs);
  const providerState = providerStatus(env, settings.provider);

  return {
    settings,
    state,
    status: {
      isDue: due.isDue,
      nextDueAt: due.nextDueAt,
      isRunning,
      providerConfigured: providerState.configured,
      providerMissingEnv: providerState.missingEnv,
    },
  };
}

export async function getBackupOverview(env: Env): Promise<BackupOverview> {
  const storage = new StorageService(env.DB);
  return buildOverview(storage, env);
}

export async function updateBackupSettings(env: Env, patch: BackupSettingsPatch, actorIp: string | null): Promise<BackupOverview> {
  const storage = new StorageService(env.DB);
  const current = await loadBackupSettings(storage);

  const next: BackupSettings = {
    enabled: patch.enabled ?? current.enabled,
    intervalMinutes: patch.intervalMinutes ?? current.intervalMinutes,
    provider: patch.provider ?? current.provider,
    pathPrefix: patch.pathPrefix !== undefined ? normalizePathPrefix(patch.pathPrefix) : current.pathPrefix,
  };

  await saveBackupSettings(storage, next);
  await storage.writeAdminAuditLog('admin.backup.settings.update', 'backup', null, actorIp, {
    enabled: next.enabled,
    intervalMinutes: next.intervalMinutes,
    provider: next.provider,
    pathPrefix: next.pathPrefix,
  });

  return buildOverview(storage, env);
}

async function runBackupInternal(env: Env, reason: BackupRunReason, actorIp: string | null, force: boolean): Promise<BackupRunResult> {
  const storage = new StorageService(env.DB);
  const nowMs = Date.now();
  const [settings, previousState] = await Promise.all([
    loadBackupSettings(storage),
    loadBackupState(storage),
  ]);

  if (!force) {
    if (!settings.enabled) {
      return {
        status: 'skipped',
        reason,
        skipReason: 'disabled',
        settings,
        state: previousState,
      };
    }

    const dueState = isDueNow(settings, previousState, nowMs);
    if (!dueState.isDue) {
      return {
        status: 'skipped',
        reason,
        skipReason: 'not_due',
        settings,
        state: previousState,
      };
    }
  }

  const lease = await acquireBackupLease(storage, reason);
  if (!lease) {
    return {
      status: 'skipped',
      reason,
      skipReason: 'already_running',
      settings,
      state: previousState,
    };
  }

  try {
    const provider = backupProviders[settings.provider];
    const providerEnvStatus = providerStatus(env, settings.provider);
    if (!providerEnvStatus.configured) {
      throw new Error(`Backup provider is not configured: ${providerEnvStatus.missingEnv.join(', ')}`);
    }

    await storage.writeAdminAuditLog('admin.backup.run.start', 'backup', null, actorIp, {
      reason,
      provider: settings.provider,
      includeAttachments: true,
    });

    const startedMs = Date.now();
    const snapshotFolder = snapshotFolderFromTimestamp(new Date(startedMs).toISOString());
    const snapshotPrefix = toObjectKey(settings.pathPrefix, snapshotFolder);
    const databaseObjectKey = `${snapshotPrefix}/database.json`;
    const attachmentsPrefix = `${snapshotPrefix}/attachments`;
    const manifestObjectKey = `${snapshotPrefix}/manifest.json`;

    const payload = await buildBackupPayload(env);
    ensureWithinTimeout(startedMs, 'database snapshot');

    const databaseUpload = await provider.upload(env, {
      objectKey: databaseObjectKey,
      contentType: 'application/json',
      body: payload,
    });
    ensureWithinTimeout(startedMs, 'database upload');

    const attachmentRefs = await listAttachmentRefs(env);
    const uploadedAttachments = await uploadAttachmentBlobs(env, provider, snapshotPrefix, attachmentRefs, startedMs);
    ensureWithinTimeout(startedMs, 'manifest build');

    const manifestPayload = buildBackupManifestPayload(
      settings.provider,
      reason,
      databaseObjectKey,
      payload.byteLength,
      attachmentsPrefix,
      uploadedAttachments.count,
      uploadedAttachments.totalBytes
    );

    const manifestUpload = await provider.upload(env, {
      objectKey: manifestObjectKey,
      contentType: 'application/json',
      body: manifestPayload,
    });
    ensureWithinTimeout(startedMs, 'manifest upload');

    const totalBackupBytes = payload.byteLength + uploadedAttachments.totalBytes + manifestPayload.byteLength;

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;

    const nextState: BackupState = {
      ...previousState,
      lastRunAt: finishedAt,
      lastRunReason: reason,
      lastStatus: 'success',
      lastSuccessAt: finishedAt,
      lastError: null,
      lastProvider: manifestUpload.provider,
      lastFileName: manifestObjectKey,
      lastLocation: manifestUpload.location,
      lastSizeBytes: totalBackupBytes,
      lastAttachmentCount: uploadedAttachments.count,
      lastAttachmentBytes: uploadedAttachments.totalBytes,
      lastDurationMs: durationMs,
    };

    await saveBackupState(storage, nextState);
    await storage.writeAdminAuditLog('admin.backup.run.success', 'backup', null, actorIp, {
      reason,
      provider: manifestUpload.provider,
      manifestObjectKey,
      manifestLocation: manifestUpload.location,
      databaseObjectKey,
      databaseLocation: databaseUpload.location,
      attachmentCount: uploadedAttachments.count,
      attachmentBytes: uploadedAttachments.totalBytes,
      sizeBytes: totalBackupBytes,
      durationMs,
    });

    return {
      status: 'success',
      reason,
      settings,
      state: nextState,
    };
  } catch (error) {
    const message = toErrorMessage(error);
    const failedAt = new Date().toISOString();

    const failedState: BackupState = {
      ...previousState,
      lastRunAt: failedAt,
      lastRunReason: reason,
      lastStatus: 'failure',
      lastFailureAt: failedAt,
      lastError: message,
      lastProvider: settings.provider,
      lastAttachmentCount: null,
      lastAttachmentBytes: null,
    };

    await saveBackupState(storage, failedState);
    await storage.writeAdminAuditLog('admin.backup.run.failure', 'backup', null, actorIp, {
      reason,
      provider: settings.provider,
      error: message,
    });

    return {
      status: 'failure',
      reason,
      settings,
      state: failedState,
    };
  } finally {
    await releaseBackupLease(storage, lease);
  }
}

export async function runBackupNow(env: Env, actorIp: string | null): Promise<BackupRunResult> {
  return runBackupInternal(env, 'manual', actorIp, true);
}

export async function runScheduledBackupIfDue(env: Env): Promise<BackupRunResult> {
  return runBackupInternal(env, 'scheduled', null, false);
}
