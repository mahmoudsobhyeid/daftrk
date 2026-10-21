import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, fullName, redirectUrl } = await req.json();

    if (!email || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, redirectUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@daftrk.app";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confirmationLink = `${redirectUrl}?confirmation=true&email=${encodeURIComponent(email)}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #2563eb; font-size: 28px; margin: 0;">دفترك — Daftrk</h1>
        </div>
        <h2 style="color: #1e293b; font-size: 22px;">Confirm your email</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Hi ${fullName || "there"},
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Thank you for signing up for Daftrk. Please confirm your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${confirmationLink}"
             style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Confirm Email
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Or copy this link into your browser:<br>
          <span style="color: #2563eb; word-break: break-all;">${confirmationLink}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="color: #94a3b8; font-size: 13px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #94a3b8; font-size: 13px;">
          © 2026 Daftrk — دفترك
        </p>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: "Confirm your email — Daftrk",
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Resend API error: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await res.json();

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
