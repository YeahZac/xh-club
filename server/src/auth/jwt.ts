import * as jwt from 'jsonwebtoken'

export type AuthPrincipalType = 'admin' | 'member'

export interface AuthPrincipal {
  sub: string
  type: AuthPrincipalType
  role?: string
}

/** 与 container.config.json 保持一致，仅作云托管未注入 env 时的兜底 */
const CONTAINER_FALLBACK_SECRET = 'xh-club-jwt-secret-change-in-production'
/** 历史开发兜底：用于校验旧版未配置 JWT_SECRET 时签发的 token */
const LEGACY_DEV_SECRET = 'xinghe-baigu-development-only-secret'

let warnedMissingSecret = false

function normalizeSecret(raw: unknown): string {
  return String(raw || '').trim()
}

function isPlaceholderSecret(secret: string): boolean {
  if (!secret) return true
  const lower = secret.toLowerCase()
  return (
    lower.includes('change-this')
    || lower.includes('change_me')
    || lower === 'your-jwt-secret-key'
    || lower === 'your-jwt-secret-key-change-this'
  )
}

/** 签发用主密钥：优先环境变量，其次容器配置默认值 */
function getSigningSecret(): string {
  const fromEnv = normalizeSecret(process.env.JWT_SECRET)
  if (fromEnv && !isPlaceholderSecret(fromEnv)) return fromEnv

  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    console.error(
      '[JWT] 未配置有效 JWT_SECRET（云托管环境变量为空或仍是占位符）。' +
        '已临时使用容器默认密钥签发；请尽快在云托管控制台设置 JWT_SECRET 并重新部署。',
    )
  }

  if (fromEnv) return fromEnv
  return CONTAINER_FALLBACK_SECRET
}

/** 校验时尝试多密钥，兼容历史 token，避免「一键登录后仍 401」 */
function getVerifySecrets(): string[] {
  const secrets: string[] = []
  const push = (value: string) => {
    if (!value || secrets.includes(value)) return
    secrets.push(value)
  }
  push(getSigningSecret())
  push(normalizeSecret(process.env.JWT_SECRET))
  push(CONTAINER_FALLBACK_SECRET)
  push(LEGACY_DEV_SECRET)
  return secrets
}

export function signAuthToken(principal: AuthPrincipal): string {
  return jwt.sign(principal, getSigningSecret(), { expiresIn: '7d' })
}

export function verifyAuthToken(token: string): AuthPrincipal {
  const secrets = getVerifySecrets()
  let lastError: unknown = null
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret) as AuthPrincipal
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('登录凭证无效或已过期')
}
