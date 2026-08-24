/** 邀请二维码文本（与小程序端 parseInviteCodeFromScan 一致） */
export const INVITE_QR_PREFIX = 'XHCLUB|INVITE|'

export function buildInviteQrText(code: string): string {
  const normalized = String(code || '').trim().toUpperCase()
  return normalized ? `${INVITE_QR_PREFIX}${normalized}` : ''
}
