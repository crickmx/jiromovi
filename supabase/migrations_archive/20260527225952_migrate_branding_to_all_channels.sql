/*
  # Migrate header/footer branding to all email channels

  1. Sets Resend Default branding as-is (already has it)
  2. Sets Resend Seguwallet branding with Seguwallet logo instead of MOVI logo
     - Same footer structure but with Seguwallet branding
     - Same color structure but with Seguwallet colors (#1a2e4a, #4a90d9)
*/

-- Copy MOVI branding to Resend Seguwallet but swap logos for Seguwallet
UPDATE notification_channels
SET branding = jsonb_build_object(
  'logo_url', '',
  'primary_color', '#1a2e4a',
  'secondary_color', '#4a90d9',
  'header_html', '<div style="background-color:#1a2e4a; border-bottom:2px solid #4a90d9; padding:24px 32px; text-align:center; font-family:Arial,sans-serif;">
<a href="https://seguwallet.com/">
<img src="https://app.movidigital.mx/seguwallet-logo.png" alt="Seguwallet" style="max-height:48px; max-width:180px; object-fit:contain;" /></a>
</div>
<div style="background-color:#4a90d9; height:4px; width:100%;"></div>',
  'footer_html', '<div style="background-color:#f8f9fa; border-top:1px solid #e9ecef; padding:20px 32px; text-align:center; font-family:Arial,sans-serif; margin-top:0;">
<a href="https://seguwallet.com/">
<img src="https://app.movidigital.mx/seguwallet-logo.png" alt="Seguwallet" style="max-height:28px; max-width:120px; opacity:0.65; object-fit:contain; display:block; margin:0 auto 10px;" />
</a>
<p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
Este mensaje fue enviado automaticamente por Seguwallet.<br/>
Si tienes preguntas, contacta a tu asesor de seguros.
</p>
<p style="margin:6px 0 0; font-size:10px; color:#d1d5db;">
&copy; 2026 Seguwallet. Todos los derechos reservados.
</p>
</div>',
  'legal_text', '© 2026 Seguwallet. Todos los derechos reservados.'
)
WHERE id = 'b2305bbc-9a1e-40e7-943d-764ef56c1ebd';
