import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://qhwvuuyjhcennqccgvse.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testQuery() {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      folio,
      tipo_tramite,
      creado_por,
      agente_id,
      solicitante:creado_por(nombre_completo),
      responsable:agente_id(nombre_completo)
    `)
    .eq('folio', 'TKEFDE3')
    .single()

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Data received:')
    console.log(JSON.stringify(data, null, 2))
  }
}

testQuery()
