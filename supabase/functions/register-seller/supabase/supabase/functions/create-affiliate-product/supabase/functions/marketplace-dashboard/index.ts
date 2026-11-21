
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  const send = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "GET") return send({ error: "GET required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");

    if (!auth?.startsWith("Bearer ")) {
      return send({ error: "Sign in required" }, 401);
    }

    const client = createClient(url, anon);
    const { data: userData, error: authError } =
      await client.auth.getUser(auth.slice(7));

    if (authError || !userData.user) {
      return send({ error: "Invalid session" }, 401);
    }

    const admin = createClient(url, service);
    const userId = userData.user.id;

    const [
      sellersResult,
      partnersResult,
    ] = await Promise.all([
      admin.from("sellers")
        .select("*")
        .eq("owner_user_id", userId),

      admin.from("affiliate_partners")
        .select("*")
        .eq("owner_user_id", userId),
    ]);

    if (sellersResult.error) throw sellersResult.error;
    if (partnersResult.error) throw partnersResult.error;

    const sellers = sellersResult.data || [];
    const partners = partnersResult.data || [];

    const sellerIds = sellers.map((item) => item.id);
    const partnerIds = partners.map((item) => item.id);

    const [
      productsResult,
      sellerCommissionsResult,
      partnerCommissionsResult,
      payoutsResult,
    ] = await Promise.all([
      admin.from("affiliate_products")
        .select("*")
        .or(
          [
            sellerIds.length
              ? `seller_id.in.(${sellerIds.join(",")})`
              : null,
            partnerIds.length
              ? `affiliate_partner_id.in.(${partnerIds.join(",")})`
              : null,
          ].filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000"
        ),

      sellerIds.length
        ? admin.from("commissions")
            .select("*")
            .in("seller_id", sellerIds)
        : Promise.resolve({ data: [], error: null }),

      partnerIds.length
        ? admin.from("commissions")
            .select("*")
            .in("affiliate_partner_id", partnerIds)
        : Promise.resolve({ data: [], error: null }),

      sellerIds.length
        ? admin.from("seller_payouts")
            .select("*")
            .in("seller_id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (sellerCommissionsResult.error) throw sellerCommissionsResult.error;
    if (partnerCommissionsResult.error) throw partnerCommissionsResult.error;
    if (payoutsResult.error) throw payoutsResult.error;

    const commissions = [
      ...(sellerCommissionsResult.data || []),
      ...(partnerCommissionsResult.data || []),
    ];

    const uniqueCommissions = [
      ...new Map(commissions.map((item) => [item.id, item])).values(),
    ];

    const earned = uniqueCommissions
      .filter((item) => item.status === "earned")
      .reduce((sum, item) => sum + Number(item.commission_amount), 0);

    return send({
      success: true,
      commission_rate: 0.05,
      commission_percentage: "5%",
      currency: "TZS",
      summary: {
        sellers: sellers.length,
        affiliate_partners: partners.length,
        products: (productsResult.data || []).length,
        active_products: (productsResult.data || [])
          .filter((item) => item.is_active).length,
        total_commissions: uniqueCommissions.length,
        earned_commissions: earned,
      },
      sellers,
      affiliate_partners: partners,
      products: productsResult.data || [],
      commissions: uniqueCommissions,
      payouts: payoutsResult.data || [],
    });
  } catch (error) {
    console.error(error);
    return send({ error: "Could not load marketplace dashboard" }, 500);
  }
});
