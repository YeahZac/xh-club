import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthPrincipalType, verifyAuthToken } from './jwt'
import { IS_PUBLIC_KEY } from './public.decorator'

function readBearerToken(request: any): string | null {
  const authorization = request.headers?.authorization
  if (typeof authorization !== 'string') return null
  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return authorize(context, 'admin')
  }
}

@Injectable()
export class MemberAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return authorize(context, 'member')
  }
}

function authorize(context: ExecutionContext, expectedType: AuthPrincipalType): boolean {
  const request = context.switchToHttp().getRequest()
  const token = readBearerToken(request)
  if (!token) throw new UnauthorizedException('缺少登录凭证')

  try {
    const principal = verifyAuthToken(token)
    if (principal.type !== expectedType) {
      throw new UnauthorizedException('登录凭证类型无效')
    }
    request.user = principal
    return true
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error
    throw new UnauthorizedException('登录凭证无效或已过期')
  }
}
