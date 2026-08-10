import type { User } from '@/types'

/** Agent gates / login redirects: honor require_2fa (default true). */
export function userSatisfies2faPolicy(user: Pick<User, 'is_2fa_enabled' | 'require_2fa'> | null | undefined): boolean {
  if (!user) return false
  if (user.require_2fa === false) return true
  return user.is_2fa_enabled
}
