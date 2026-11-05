// Provider webhooks must be verified using the gateway's documented signature algorithm.
// A webhook is the only trusted source for payment confirmation; never accept a browser redirect alone.
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  if (!process.env.PAYMENT_WEBHOOK_SECRET) return new Response("Webhook not configured",{status:503});
  // TODO: verify raw-body signature, enforce idempotency, match provider reference and amount,
  // update payment + order status transactionally, then return 200.
  return new Response("Webhook adapter not implemented",{status:501});
};
