import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// DISABLED. This was a leftover email relay from the "V4 Money" commissioning
// product — not used by EnriqueceAI (no caller in the codebase). As written it
// let any authenticated platform user send branded emails from a trusted domain
// to arbitrary recipients, with unescaped HTML and no rate limit — a phishing
// relay. It is neutralized here to a 410 and sends nothing.
//
// INFRA ACTION REQUIRED: the previously deployed version is still live until
// redeployed or removed. @devops: run `supabase functions delete send-invite-email`
// (or redeploy this stub) to take the relay off the air.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = (req: Request): Response => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ error: "This function has been disabled." }),
    { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
};

serve(handler);
