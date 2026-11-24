// Seguimiento de entrega de mensajes enviados por Wazzup24.
//
// Wazzup acepta el mensaje con un 201 y devuelve un `messageId`, pero la entrega
// real (Meta/WhatsApp) se resuelve después y llega por el webhook como un eco
// (`isEcho: true`) o en `statuses[]`, con `status: "error"` y un objeto `error`
// cuando WhatsApp lo rechaza. Para poder marcar esos envíos como fallidos,
// cada envío guarda el `messageId` en `correo_historial_envios.provider_message_id`.

// deno-lint-ignore no-explicit-any
type AnyClient = any;

/** Extrae el messageId de la respuesta JSON de POST /v3/message. */
export function wazzupMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const id = (body as { messageId?: unknown }).messageId;
  return typeof id === "string" && id ? id : null;
}

/** Lee la respuesta de Wazzup una sola vez y devuelve el cuerpo (JSON o texto) y el messageId. */
export async function readWazzupResponse(res: Response): Promise<{ body: unknown; text: string; messageId: string | null }> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // respuesta no JSON: se conserva el texto
  }
  return { body, text, messageId: wazzupMessageId(body) };
}

/** Texto legible del error que reporta Wazzup en el webhook. */
export function describeWazzupError(error: unknown): string {
  if (!error || typeof error !== "object") return "WhatsApp rechazó el mensaje";
  const e = error as { error?: unknown; description?: unknown };
  const code = typeof e.error === "string" ? e.error : null;
  const description = typeof e.description === "string" ? e.description : null;
  if (code && description) return `${code}: ${description}`;
  return code || description || "WhatsApp rechazó el mensaje";
}

/**
 * Marca como fallido el envío con ese messageId en el historial de notificaciones
 * y en el centro de contacto. Devuelve cuántas filas del historial se actualizaron.
 */
export async function markWazzupDeliveryFailed(
  supabase: AnyClient,
  messageId: string,
  error: unknown,
): Promise<{ historial: number; errors: string[] }> {
  const mensaje = `Wazzup: ${describeWazzupError(error)}`;
  const errors: string[] = [];

  const { data: hist, error: histErr } = await supabase
    .from("correo_historial_envios")
    .update({ estado: "fallido", error_mensaje: mensaje })
    .eq("provider_message_id", messageId)
    .select("id");
  if (histErr) errors.push(`historial:${histErr.message}`);

  const { error: ccmErr } = await supabase
    .from("contact_center_messages")
    .update({ status: "failed", error_message: mensaje, updated_at: new Date().toISOString() })
    .eq("provider_message_id", messageId);
  if (ccmErr) errors.push(`contact_center:${ccmErr.message}`);

  return { historial: Array.isArray(hist) ? hist.length : 0, errors };
}
