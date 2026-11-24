import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Contacto {
  id: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  creado_por: string;
  tipo_contacto: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    console.log(`[Birthday Reminders] Procesando cumpleaños para: ${currentDay}/${currentMonth}/${currentYear}`);

    const { data: contactos, error: contactosError } = await supabase
      .from("crm_contactos")
      .select("id, nombre_completo, fecha_nacimiento, creado_por, tipo_contacto")
      .eq("tipo_contacto", "Persona")
      .not("fecha_nacimiento", "is", null);

    if (contactosError) {
      throw new Error(`Error al obtener contactos: ${contactosError.message}`);
    }

    if (!contactos || contactos.length === 0) {
      console.log("[Birthday Reminders] No hay contactos con fecha de nacimiento");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No hay contactos con fecha de nacimiento",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const birthdayContacts = contactos.filter((contacto: Contacto) => {
      if (!contacto.fecha_nacimiento) return false;

      const birthDate = new Date(contacto.fecha_nacimiento);
      const birthMonth = birthDate.getMonth() + 1;
      const birthDay = birthDate.getDate();

      return birthMonth === currentMonth && birthDay === currentDay;
    });

    console.log(`[Birthday Reminders] Encontrados ${birthdayContacts.length} cumpleaños hoy`);

    let processedCount = 0;
    const results = [];

    for (const contacto of birthdayContacts) {
      try {
        const { data: existingReminder } = await supabase
          .from("crm_birthday_reminders")
          .select("id")
          .eq("contacto_id", contacto.id)
          .eq("usuario_id", contacto.creado_por)
          .eq("year", currentYear)
          .single();

        if (existingReminder) {
          console.log(`[Birthday Reminders] Ya existe recordatorio para ${contacto.nombre_completo} este año`);
          continue;
        }

        // Usar sistema de plantillas para enviar notificación
        const { error: notifError } = await supabase.rpc('enviar_notificacion_completa', {
          p_tipo_codigo: 'cumpleanos_contacto',
          p_user_id: contacto.creado_por,
          p_titulo: '🎂 Cumpleaños hoy',
          p_mensaje: `Hoy es el cumpleaños de ${contacto.nombre_completo}. ¡Escríbele o llámale!`,
          p_modulo: 'crm',
          p_datos_adicionales: {
            nombre_contacto: contacto.nombre_completo,
            contacto_url: `/mi-crm/contacto/${contacto.id}`
          },
          p_accion_url: `/mi-crm/contacto/${contacto.id}`
        });

        if (notifError) {
          console.error(`[Birthday Reminders] Error al enviar notificación para ${contacto.nombre_completo}:`, notifError);
        }

        const startOfDay = new Date(currentYear, currentMonth - 1, currentDay, 0, 0, 0);
        const endOfDay = new Date(currentYear, currentMonth - 1, currentDay, 23, 59, 59);

        const { error: calendarError } = await supabase
          .from("dashboard_calendar_events")
          .insert({
            usuario_id: contacto.creado_por,
            titulo: `🎂 Cumpleaños: ${contacto.nombre_completo}`,
            descripcion: `Es el cumpleaños de ${contacto.nombre_completo}. ¡No olvides felicitarlo!`,
            fecha_inicio: startOfDay.toISOString(),
            fecha_fin: endOfDay.toISOString(),
            todo_el_dia: true,
            tipo_evento: "cumpleanos",
            color: "#ec4899",
            entidad_tipo: "crm_contacto",
            entidad_id: contacto.id,
            metadata: {
              contacto_nombre: contacto.nombre_completo,
              deep_link: `/mi-crm/contacto/${contacto.id}`
            }
          });

        if (calendarError) {
          console.error(`[Birthday Reminders] Error al crear evento de calendario para ${contacto.nombre_completo}:`, calendarError);
        }

        const { error: reminderError } = await supabase
          .from("crm_birthday_reminders")
          .insert({
            contacto_id: contacto.id,
            usuario_id: contacto.creado_por,
            year: currentYear,
            notificacion_enviada: !notifError,
            calendario_creado: !calendarError
          });

        if (reminderError) {
          console.error(`[Birthday Reminders] Error al registrar recordatorio para ${contacto.nombre_completo}:`, reminderError);
        }

        processedCount++;
        results.push({
          contacto: contacto.nombre_completo,
          success: true,
          notificacion: !notifError,
          calendario: !calendarError
        });

        console.log(`[Birthday Reminders] ✓ Procesado cumpleaños de ${contacto.nombre_completo}`);

      } catch (error) {
        console.error(`[Birthday Reminders] Error procesando ${contacto.nombre_completo}:`, error);
        results.push({
          contacto: contacto.nombre_completo,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Procesados ${processedCount} cumpleaños`,
        date: `${currentDay}/${currentMonth}/${currentYear}`,
        total_found: birthdayContacts.length,
        processed: processedCount,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("[Birthday Reminders] Error general:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
