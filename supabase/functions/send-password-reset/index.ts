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
    const { email, resetUrl, userName, lang = 'ar' } = await req.json();

    if (!email || !resetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, resetUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Daftrk <onboarding@resend.dev>";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY secret not configured in Supabase.",
          code: "RESEND_API_KEY_MISSING",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAr = lang !== 'en';
    const subject = isAr
      ? "إعادة تعيين كلمة المرور لحسابك على منصة دفترك"
      : "Reset your password for Daftrk";

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 18px; background-color: #f8fafc; color: #1e293b; direction: ${isAr ? 'rtl' : 'ltr'}; text-align: ${isAr ? 'right' : 'left'};">
        <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <div style="text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
            <h1 style="color: #2563eb; font-size: 26px; margin: 0 0 6px 0; font-weight: 800;">دفترك — Daftrk</h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">منصة الفواتير وإدارة الأعمال الذكية</p>
          </div>

          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 14px 0; font-weight: 700;">
            ${isAr ? `طلب إعادة تعيين كلمة المرور` : `Password Reset Request`}
          </h2>

          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
            ${isAr
              ? `مرحباً ${userName ? `<strong>${userName}</strong>` : ''}، تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على منصة دفترك.`
              : `Hi ${userName ? `<strong>${userName}</strong>` : 'there'}, we received a request to reset your password on Daftrk.`}
          </p>

          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
            ${isAr
              ? 'انقر على الزر أدناه لاختيار كلمة مرور جديدة لحسابك وتأمين دخولك:'
              : 'Click the button below to choose a new password for your account:'}
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
              ${isAr ? 'إعادة تعيين كلمة المرور الآن' : 'Reset My Password'}
            </a>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 20px;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
              ${isAr ? 'أو يمكنك نسخ الرابط التالي ولصقه في المتصفح:' : 'Or copy and paste this link into your browser:'}
            </p>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px; text-decoration: underline;">
              ${resetUrl}
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 18px; text-align: center;">
            ${isAr
              ? '⚠️ هذا الرابط آمن وصالح لفترة محدودة. إذا لم تكن قد طلبت إعادة التعيين بنفسك، يرجى تجاهل هذه الرسالة وستظل كلمة مرورك الحالية آمنة دون تغيير.'
              : '⚠️ This link is single-use and will expire. If you did not request a password reset, you can safely ignore this email.'}
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;">

          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            © 2026 Daftrk — منصة دفترك
          </p>

        </div>
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
        subject,
        html: htmlBody,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('send-password-reset: provider error', { status: res.status, body: text });
      return new Response(
        JSON.stringify({ error: `Email provider error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
