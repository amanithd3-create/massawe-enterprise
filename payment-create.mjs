// Server-side payment adapter boundary. Implement the exact provider contract from your
// signed merchant documentation. Never trust client-submitted prices or mark an order paid here.
export default async (req) => {
  if (req.method !== "POST") return Response.json({error:"Method not allowed"},{status:405});
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({error:"Server database is not configured"},{status:503});
  if (!process.env.PAYMENT_API_BASE_URL || !process.env.PAYMENT_API_KEY || !process.env.PAYMENT_API_SECRET) {
    return Response.json({error:"Payment provider credentials are not configured. No payment was taken."},{status:503});
  }
  // TODO production integration: validate cart and stock against Supabase using service role;
  // create pending order and payment intent; sign provider request; persist provider reference;
  // return provider checkout/USSD instructions. Provider signature format varies by contract.
  return Response.json({error:"Provider adapter is not yet implemented. Configure and test the selected gateway before enabling checkout."},{status:501});
};
