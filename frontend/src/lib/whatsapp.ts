/** wa.me link with a prefilled message. Phone is optional (opens the contact picker). */
export function whatsappLink(text: string, phone?: string | null) {
  const digits = phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "880") : "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
export const smsLink = (text: string, phone?: string | null) =>
  `sms:${phone || ""}?&body=${encodeURIComponent(text)}`;
