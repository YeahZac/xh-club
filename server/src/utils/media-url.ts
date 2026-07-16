function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildCosUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
}

export function isCloudStorageUrl(input: unknown): input is string {
  return typeof input === 'string'
    && /^https:\/\/[^/]*(?:\.myqcloud\.com|\.tcb\.qcloud\.la)\//i.test(input.trim());
}

export type CosObjectInfo = {
  bucket: string;
  region: string;
  key: string;
};

/**
 * Extract COS bucket/region/key from a cloud storage URL or cloud:// id.
 */
export function extractCosObjectInfo(input: unknown): CosObjectInfo | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  const regionFallback = process.env.COS_REGION || 'ap-shanghai';
  const bucketFallback = process.env.COS_BUCKET || '';

  if (value.startsWith('cloud://')) {
    const withoutPrefix = value.slice('cloud://'.length);
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex === -1) return null;
    const envAndBucket = withoutPrefix.slice(0, slashIndex);
    const key = decodeURIComponent(withoutPrefix.slice(slashIndex + 1));
    if (!key) return null;
    const bucketFromCloudId = envAndBucket.includes('.')
      ? envAndBucket.split('.').slice(1).join('.')
      : envAndBucket;
    const bucket = bucketFromCloudId || bucketFallback;
    if (!bucket) return null;
    return { bucket, region: regionFallback, key };
  }

  try {
    const url = new URL(value.startsWith('http') ? value : normalizeMediaUrl(value));
    const host = url.hostname;
    const cosMatch = host.match(/^(.+)\.cos\.([a-z0-9-]+)\.myqcloud\.com$/i);
    if (cosMatch) {
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (!key) return null;
      return { bucket: cosMatch[1], region: cosMatch[2], key };
    }
    if (/\.tcb\.qcloud\.la$/i.test(host)) {
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (!key) return null;
      return {
        bucket: bucketFallback || host.split('.')[0],
        region: regionFallback,
        key,
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Persist only the canonical object URL (no query/signature).
 */
export function canonicalizeCloudStorageUrl(input: unknown): string {
  const normalized = normalizeMediaUrl(input);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    if (!isCloudStorageUrl(url.toString())) {
      return normalized;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return normalized;
  }
}

/**
 * Normalize stored media path into a web-accessible URL.
 * Supports:
 * - https://...
 * - cloud://<env>.<bucket>/<key>
 * - /images/...
 * - images/... (COS key)
 */
export function normalizeMediaUrl(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  const value = input.trim();
  if (!value) {
    return '';
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const region = process.env.COS_REGION || 'ap-shanghai';
  const configuredBucket = process.env.COS_BUCKET || '';

  if (value.startsWith('cloud://')) {
    const withoutPrefix = value.slice('cloud://'.length);
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex === -1) {
      return value;
    }

    const envAndBucket = withoutPrefix.slice(0, slashIndex);
    const key = withoutPrefix.slice(slashIndex + 1);
    if (!key) {
      return value;
    }

    // cloud://<env>.<bucket>/<key> -> extract bucket
    const bucketFromCloudId = envAndBucket.includes('.')
      ? envAndBucket.split('.').slice(1).join('.')
      : '';
    const bucket = bucketFromCloudId || configuredBucket;
    if (!bucket) {
      return value;
    }

    return buildCosUrl(bucket, region, key);
  }

  if (value.startsWith('/')) {
    const projectDomain = process.env.PROJECT_DOMAIN
      ? trimTrailingSlash(process.env.PROJECT_DOMAIN)
      : '';
    return projectDomain ? `${projectDomain}${value}` : value;
  }

  // Plain COS key path such as images/xxx.jpg
  if (configuredBucket && value.includes('/')) {
    return buildCosUrl(configuredBucket, region, value);
  }

  return value;
}
