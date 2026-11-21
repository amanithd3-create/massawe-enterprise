
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    const affiliateCode = String(body.affiliate_code || "").trim();
    const listingId = String(body.listing_id || "").trim();

    if (!affiliateCode || !listingId) {
      return respond({
        error: "affiliate_code and listing_id are required"
      }, 400);
    }

    const { data: affiliate, error: affiliateError } =
      await supabase
        .from("affiliate_partners")
        .select("id,status")
        .eq("affiliate_code", affiliateCode)
        .eq("status", "approved")
        .maybeSingle();

    if (affiliateError || !affiliate) {
      return respond({ error: "Invalid or inactive affiliate" }, 404);
    }

    const { data: listing, error: listingError } =
      await supabase
        .from("marketplace_listings")
        .select("id,status")
        .eq("id", listingId)
        .eq("status", "active")
        .maybeSingle();

    if (listingError || !listing) {
      return respond({ error: "Product not found or inactive" }, 404);
    }

    const { data: click, error: clickError } =
      await supabase
        .from("affiliate_clicks")
        .insert({
          affiliate_id: affiliate.id,
          listing_id: listing.id,
          landing_path: String(body.landing_path || "").slice(0, 500),
          referrer: String(body.referrer || "").slice(0, 500),
        })
        .select("id,created_at")
        .single();

    if (clickError) {
      console.error(clickError);
      return respond({ error: "Could not record click" }, 500);
    }

    return respond({
      success: true,
      message: "Affiliate click recorded",
      click_id: click.id,
      created_at: click.created_at,
    });

  } catch (error) {
    console.error(error);
    return respond({ error: "Internal server error" }, 500);
  }
});
