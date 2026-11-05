/*
 * Payment adapter boundary.
 * This intentionally refuses to pretend that a payment happened.
 * Implement the chosen Tanzanian provider against its official merchant API:
 * - createCheckout(): create provider transaction and return its hosted checkout URL/reference.
 * - verifyWebhook(): verify signature/authenticity using the provider's documented algorithm.
 * - parseWebhook(): return { providerReference, orderNumber, paid, amount, currency }.
 * Never mark an order PAID based only on a browser redirect.
 */
export async function createCheckout({ order }) {
  const provider = process.env.PAYMENT_PROVIDER || "disabled";
  if (provider === "disabled" || !process.env.PAYMENT_API_KEY || !process.env.PAYMENT_API_SECRET) {
    const error = new Error("Online payments are not configured. Contact the store administrator.");
    error.status = 503;
    throw error;
  }
  // Provider-specific signed request must be implemented after merchant account/API docs are supplied.
  const error = new Error(`Payment provider adapter "${provider}" is not implemented yet. No charge was made.`);
  error.status = 501;
  throw error;
}
export function verifyWebhook(_req) {
  // Fail closed until the selected provider's signature validation is implemented.
  return false;
}
