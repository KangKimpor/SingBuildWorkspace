/** Only SingBuild staff accounts can sign in or sign up (for example kimpor.kang@singbuild.com). */
export const ALLOWED_EMAIL_DOMAIN = 'singbuild.com'
export const DOMAIN_ERROR = `Sign in with your @${ALLOWED_EMAIL_DOMAIN} email. Other accounts are not allowed.`
export const allowedEmail = (email: string | null | undefined) => !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
