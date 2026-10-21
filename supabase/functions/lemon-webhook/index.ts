import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const event = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { meta, data } = event;
    const eventName = meta?.event_name ?? "";

    if (eventName !== "subscription_created" && eventName !== "subscription_updated") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subId = String(data?.id ?? "");
    const status = data?.status ?? "active";
    const variantId = String(data?.variant_id ?? "");
    const periodEnd = data?.ends_at ?? data?.renews_at ?? null;
    const tenantId = String(data?.custom?.tenant_id ?? meta?.custom_data?.tenant_id ?? "");

    if (!subId || !tenantId) {
      return new Response(JSON.stringify({ ok: false, error: "missing sub_id or tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mappedStatus = status === "active" ? "active" : status === "past_due" ? "past_due" : "cancelled";

    const { error } = await supabase
      .from("lemon_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          lemon_subscription_id: subId,
          status: mappedStatus,
          variant_id: variantId,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lemon_subscription_id" }
      );

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
