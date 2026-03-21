export const GUEST_EMAIL_DOMAIN = "@grandmate.local";

export function isGuestEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith(GUEST_EMAIL_DOMAIN));
}
