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

