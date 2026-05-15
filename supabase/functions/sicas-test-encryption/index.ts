import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_3DES_KEY = "%SOnlineBOGO2001-2015WS#";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const CryptoJS = (await import("npm:crypto-js@4.2.0")).default;

    const testXml = "<InfoData><DatDocumentos><IDDocto>-1</IDDocto><IDCia>3</IDCia></DatDocumentos></InfoData>";
    const username = Deno.env.get("SICAS_USERNAME") || "testuser";

    const diagnostics: Record<string, any> = {
      cryptojs_type: typeof CryptoJS,
      cryptojs_keys: Object.keys(CryptoJS || {}).slice(0, 20),
      has_TripleDES: !!CryptoJS?.TripleDES,
      has_enc: !!CryptoJS?.enc,
      has_enc_Latin1: !!CryptoJS?.enc?.Latin1,
      has_enc_Latin1_parse: typeof CryptoJS?.enc?.Latin1?.parse,
      has_mode_CBC: !!CryptoJS?.mode?.CBC,
      has_pad_ZeroPadding: !!CryptoJS?.pad?.ZeroPadding,
      has_TripleDES_encrypt: typeof CryptoJS?.TripleDES?.encrypt,
    };

    // Try the actual encryption
    const urlEncodedXml = encodeURIComponent(testXml);
    const key = CryptoJS.enc.Latin1.parse(SICAS_3DES_KEY);
    const ivStr = username.substring(0, 8).padEnd(8, "\0");
    const iv = CryptoJS.enc.Latin1.parse(ivStr);

    const encrypted = CryptoJS.TripleDES.encrypt(
      urlEncodedXml,
      key,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding }
    );

    const encryptedStr = encrypted.toString();

    diagnostics.encrypted_length = encryptedStr.length;
    diagnostics.encrypted_preview = encryptedStr.substring(0, 60);
    diagnostics.is_base64 = /^[A-Za-z0-9+/=]+$/.test(encryptedStr);
    diagnostics.contains_xml = encryptedStr.includes("<InfoData>");
    diagnostics.encryption_success = encryptedStr.length > 10 && !encryptedStr.includes("<InfoData>");
    diagnostics.input_length = urlEncodedXml.length;

    // Also try to decrypt to verify round-trip
    try {
      const decrypted = CryptoJS.TripleDES.decrypt(encryptedStr, key, {
        iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding
      });
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      diagnostics.decrypt_success = decryptedStr.startsWith("%3CInfoData");
      diagnostics.round_trip_ok = decryptedStr === urlEncodedXml || decryptedStr.startsWith(urlEncodedXml);
    } catch (decErr: any) {
      diagnostics.decrypt_error = decErr.message;
    }

    return new Response(JSON.stringify({ success: true, diagnostics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack?.split("\n").slice(0, 5),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
