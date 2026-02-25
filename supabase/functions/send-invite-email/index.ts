import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const handler = async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { email, inviterName, platformUrl } = await req.json();
    console.log('Sending invite email to:', email, 'from:', inviterName);
    const emailResponse = await resend.emails.send({
      from: "V4 Money <vinicius@v4companyamaral.com>",
      to: [
        email
      ],
      subject: "🎯 Convite para V4 Money - Sistema de Comissionamento",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Convite V4 Money</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh;">
          <div style="max-width: 650px; margin: 0 auto; padding: 40px 20px;">
            
            <!-- Header elegante -->
            <div style="background: white; border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
               <div style="margin-bottom: 0; text-align: center;">
                 <h1 style="color: #1f2937; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">V4 Money</h1>
                 <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">Sistema de Comissionamento</p>
               </div>
            </div>

            <!-- Conteúdo principal -->
            <div style="background: white; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 35px;">
                <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #dc2626, #ef4444); border-radius: 2px; margin: 0 auto 25px;"></div>
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 28px; font-weight: 600;">Você foi convidado! 🎉</h2>
                <p style="color: #4b5563; font-size: 16px; margin: 0;">Bem-vindo à nossa plataforma de gestão de comissões</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #fef7f7, #fef2f2); border: 1px solid #fecaca; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <p style="color: #374151; line-height: 1.7; margin: 0 0 20px 0; font-size: 16px;">
                  <strong style="color: #dc2626;">${inviterName}</strong> convidou você para acessar o <strong>V4 Money</strong>, nossa plataforma completa de gestão de comissões e participações.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 15px;">
                  Faça seu cadastro com este email: <strong style="color: #dc2626;">${email}</strong>
                </p>
                
                 <div style="text-align: center;">
                   <a href="https://v4money.v4companyamaral.com/auth" 
                      style="display: inline-block; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 6px 20px rgba(220, 38, 38, 0.3); transition: all 0.3s ease; border: none;">
                     🚀 Acessar V4 Money
                   </a>
                 </div>
              </div>
            </div>
            
            <!-- Recursos da plataforma -->
            <div style="background: white; padding: 35px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <h3 style="color: #1f2937; margin: 0 0 25px 0; font-size: 20px; font-weight: 600; text-align: center;">
                ✨ Recursos da Plataforma
              </h3>
              <div style="display: grid; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 12px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <span style="color: #dc2626; font-size: 20px;">📊</span>
                  <span style="color: #374151; font-size: 15px; font-weight: 500;">Acompanhar comissões em tempo real</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <span style="color: #dc2626; font-size: 20px;">📋</span>
                  <span style="color: #374151; font-size: 15px; font-weight: 500;">Visualizar contratos e participações</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <span style="color: #dc2626; font-size: 20px;">📈</span>
                  <span style="color: #374151; font-size: 15px; font-weight: 500;">Consultar histórico de ganhos</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <span style="color: #dc2626; font-size: 20px;">📑</span>
                  <span style="color: #374151; font-size: 15px; font-weight: 500;">Gerar relatórios personalizados</span>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: white; border-radius: 0 0 16px 16px; padding: 30px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 1px solid #f3f4f6;">
              <div style="margin-bottom: 20px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
                  Este convite é exclusivo para: <strong style="color: #dc2626;">${email}</strong>
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  Caso não esperasse este convite, você pode ignorar este email com segurança.
                </p>
              </div>
              
              <div style="border-top: 1px solid #f3f4f6; padding-top: 20px;">
                 <div style="text-align: center; margin-bottom: 8px;">
                   <span style="color: #374151; font-weight: 600; font-size: 16px;">V4 Amaral & Co</span>
                 </div>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">Sistema de Comissionamento Empresarial</p>
              </div>
            </div>
            
          </div>
        </body>
        </html>
      `
    });
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      return new Response(JSON.stringify({
        error: "Falha ao enviar email",
        details: emailResponse.error
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log("Email sent successfully:", emailResponse);
    return new Response(JSON.stringify({
      success: true,
      message: "Email enviado com sucesso",
      data: emailResponse
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in send-invite-email function:", error);
    // Tratar diferentes tipos de erro
    let errorMessage = "Erro interno do servidor";
    let statusCode = 500;
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      errorMessage = "Erro de conectividade. Tente novamente.";
      statusCode = 503;
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      errorMessage = "Dados inválidos fornecidos";
      statusCode = 400;
    }
    return new Response(JSON.stringify({
      error: errorMessage,
      details: error.message
    }), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};
serve(handler);
