import * as jwt from 'jsonwebtoken'

export type AuthPrincipalType = 'admin' | 'member'

export interface AuthPrincipal {
  sub: string
  type: AuthPrincipalType
  role?: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 JWT_SECRET')
  }
  return 'xinghe-baigu-development-only-secret'
}

export function signAuthToken(principal: AuthPrincipal): string {
  return jwt.sign(principal, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyAuthToken(token: string): AuthPrincipal {
  return jwt.verify(token, getJwtSecret()) as AuthPrincipal
}
