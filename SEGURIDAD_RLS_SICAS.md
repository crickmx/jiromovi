# Seguridad RLS del Sistema SICAS

## Principio Fundamental

**NUNCA confiar en el frontend para filtrar datos sensibles.**

Todo el filtrado de seguridad se realiza en la base de datos mediante Row Level Security (RLS). El frontend solo hace queries simples y RLS se encarga automáticamente de filtrar según el rol y permisos del usuario.

---

## Modelo de Permisos

### 1. Agente
- **Ve:** Solo sus propios datos
- **Filtrado:** A través de `sicas_mapeo_vendedor_usuario` que vincula su `user_id` con `vend_id` de SICAS
- **Restricción:** No puede ver datos de otros vendedores

### 2. Gerente
- **Ve:** Todos los datos de su oficina
- **Filtrado:** Doble verificación:
  1. A través de `sicas_mapeo_despacho_oficina` (despachos mapeados a su oficina)
  2. A través de vendedores que pertenecen a su oficina
- **Restricción:** No puede ver datos de otras oficinas

### 3. Administrador
- **Ve:** Todo sin restricción
- **Filtrado:** Ninguno (acceso total)
- **Restricción:** Ninguna

### 4. Service Role (Edge Functions)
- **Ve:** Todo
- **Uso:** Solo para sincronizaciones automáticas
- **Acceso:** Insert/Update/Delete masivo

---

## Tablas Protegidas

### 1. `sicas_polizas_vigentes`

#### Políticas RLS

```sql
-- Administrador: Acceso total
CREATE POLICY "Administrador ve todas las polizas SICAS"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

-- Agente: Solo sus pólizas
CREATE POLICY "Agente ve solo sus polizas SICAS"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
      WHERE u.id = auth.uid()
        AND u.deleted_at IS NULL
        AND mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
    )
  );

-- Gerente: Pólizas de su oficina
CREATE POLICY "Gerente ve polizas de su oficina SICAS"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND (
          -- Vía mapeo de despacho
          EXISTS (
            SELECT 1 FROM sicas_mapeo_despacho_oficina mdo
            WHERE mdo.id_sicas_despacho = sicas_polizas_vigentes.desp_id
              AND mdo.movi_oficina_id = u.oficina_id
          )
          OR
          -- Vía vendedores de la oficina
          EXISTS (
            SELECT 1 FROM sicas_mapeo_vendedor_usuario mvu
            JOIN usuarios u2 ON u2.id = mvu.movi_user_id
            WHERE mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
              AND u2.oficina_id = u.oficina_id
              AND u2.deleted_at IS NULL
          )
        )
    )
  );
```

### 2. `sicas_cobranza_pendiente`

Políticas idénticas a `sicas_polizas_vigentes` pero aplicadas a la tabla de cobranza.

### 3. `sicas_renovaciones_proximas` (Vista)

Esta es una **vista** sobre `sicas_polizas_vigentes`, por lo que hereda automáticamente las políticas RLS de la tabla base.

### 4. `sicas_emitidas_mes_actual` (Vista)

Similar a renovaciones, es una vista que hereda RLS de `sicas_polizas_vigentes`.

### 5. `sicas_mapeo_vendedor_usuario`

```sql
-- Administrador: Gestiona todo el mapeo
CREATE POLICY "Administrador gestiona mapeo vendedores"
  ON sicas_mapeo_vendedor_usuario FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

-- Usuario: Ve su propio mapeo
CREATE POLICY "Usuario ve su propio mapeo vendedor"
  ON sicas_mapeo_vendedor_usuario FOR SELECT TO authenticated
  USING (movi_user_id = auth.uid());

-- Gerente: Ve mapeo de su oficina
CREATE POLICY "Gerente ve mapeo de su oficina"
  ON sicas_mapeo_vendedor_usuario FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM usuarios u2
          WHERE u2.id = sicas_mapeo_vendedor_usuario.movi_user_id
            AND u2.oficina_id = u.oficina_id
            AND u2.deleted_at IS NULL
        )
    )
  );
```

---

## Cómo Funciona en la Práctica

### Ejemplo: Agente consulta sus pólizas

#### Frontend (MiProduccionSICAS.tsx)
```typescript
// Código simple: NO hace filtrado manual
const { data, error } = await supabase
  .from('sicas_polizas_vigentes')
  .select('*')
  .order('vigencia_hasta', { ascending: true });
```

#### Backend (Postgres + RLS)
```sql
-- Supabase intercepta la query y añade automáticamente:
SELECT * FROM sicas_polizas_vigentes
WHERE EXISTS (
  SELECT 1 FROM usuarios u
  JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
  WHERE u.id = '12345-user-uuid'  -- auth.uid() del usuario actual
    AND u.deleted_at IS NULL
    AND mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
)
ORDER BY vigencia_hasta ASC;
```

**Resultado:** El usuario solo recibe las pólizas que le corresponden, sin necesidad de filtrado manual en el frontend.

---

## Protección Contra Ataques

### Ataque 1: Usuario modifica código del frontend

**Escenario:**
```typescript
// Usuario malicioso modifica el código y hace:
const { data } = await supabase
  .from('sicas_polizas_vigentes')
  .select('*')
  .eq('vend_id', 'OTRO_VENDEDOR_ID');  // Intenta ver datos de otro
```

**Protección:**
RLS sigue aplicando las políticas. Aunque el usuario intente filtrar por otro vendedor, Postgres añade el filtro de seguridad:

```sql
-- La query real ejecutada es:
SELECT * FROM sicas_polizas_vigentes
WHERE vend_id = 'OTRO_VENDEDOR_ID'
  AND EXISTS (
    -- Política RLS sigue activa
    SELECT 1 FROM usuarios u
    JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
    WHERE u.id = auth.uid()
      AND mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
  );
```

**Resultado:** Query retorna vacía porque `vend_id = 'OTRO_VENDEDOR_ID'` pero RLS requiere que sea SU vendedor.

### Ataque 2: Llamada directa a API con curl

**Escenario:**
```bash
curl -X GET 'https://proyecto.supabase.co/rest/v1/sicas_polizas_vigentes' \
  -H "Authorization: Bearer TOKEN_DE_AGENTE"
```

**Protección:**
RLS se aplica igualmente. El token contiene `auth.uid()` del agente y Postgres aplica automáticamente las políticas.

**Resultado:** Solo obtiene sus propios datos.

### Ataque 3: Suplantación de token

**Escenario:**
Usuario intenta usar token de otro usuario.

**Protección:**
- JWT firmado por Supabase (imposible falsificar sin la clave secreta)
- `auth.uid()` extraído directamente del JWT verificado
- RLS usa `auth.uid()` que es inmutable durante la sesión

**Resultado:** Imposible suplantar identidad.

---

## Edge Functions y Service Role

### Funcionamiento

Las edge functions usan `SUPABASE_SERVICE_ROLE_KEY` que **bypassa RLS completamente**.

```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // ← Bypassa RLS
);
```

### Uso Seguro

#### ✅ Correcto: Sincronización masiva
```typescript
// Edge function: sicas-sync-cobranza
await supabase.from("sicas_cobranza_pendiente").delete().neq("id", "...");
await supabase.from("sicas_cobranza_pendiente").insert([...todos los registros...]);
```

**Justificación:** La función obtiene datos desde SICAS (fuente externa confiable) y los sincroniza en bloque. No depende de input del usuario.

#### ❌ Incorrecto: Aceptar parámetros de usuario
```typescript
// NUNCA hacer esto:
const { vendorId } = await req.json();  // ← Input del usuario
const { data } = await supabase
  .from("sicas_polizas_vigentes")
  .select("*")
  .eq("vend_id", vendorId);  // ← Peligro: podría obtener datos de cualquiera
```

**Problema:** Service role bypassa RLS, por lo que retornaría datos de cualquier vendedor.

**Solución:** Si necesitas parámetros de usuario en edge function:
```typescript
// Obtener usuario autenticado primero
const authHeader = req.headers.get("Authorization");
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,  // ← Usa anon key
  { global: { headers: { Authorization: authHeader } } }
);

// Ahora RLS SÍ aplica
const { data } = await supabaseClient
  .from("sicas_polizas_vigentes")
  .select("*");  // ← Solo obtiene lo permitido por RLS
```

---

## Verificación de Seguridad

### Test Manual 1: Agente no ve datos de otro agente

```sql
-- Como agente_1 (user_id = 'uuid-agente-1')
-- Mapeado a vend_id = 'V001'
SET LOCAL jwt.claims.sub = 'uuid-agente-1';
SELECT COUNT(*) FROM sicas_polizas_vigentes;
-- Resultado: Solo pólizas con vend_id = 'V001'

-- Intentar ver otro vendedor
SELECT * FROM sicas_polizas_vigentes WHERE vend_id = 'V002';
-- Resultado: 0 rows (aunque existan pólizas de V002)
```

### Test Manual 2: Gerente ve su oficina

```sql
-- Como gerente_1 (oficina_id = 'oficina-A')
SET LOCAL jwt.claims.sub = 'uuid-gerente-1';
SELECT COUNT(*) FROM sicas_polizas_vigentes;
-- Resultado: Solo pólizas de vendedores de oficina-A o despachos mapeados a oficina-A
```

### Test Manual 3: Admin ve todo

```sql
-- Como admin
SET LOCAL jwt.claims.sub = 'uuid-admin';
SELECT COUNT(*) FROM sicas_polizas_vigentes;
-- Resultado: Todas las pólizas sin filtro
```

---

## Índices de Performance

Para que RLS no afecte performance, se crearon índices específicos:

```sql
-- Índice para búsquedas por vendedor (usado en RLS)
CREATE INDEX idx_sicas_polizas_vend_id ON sicas_polizas_vigentes(vend_id);
CREATE INDEX idx_sicas_cobranza_vend_id ON sicas_cobranza_pendiente(vend_id);

-- Índice para búsquedas por despacho
CREATE INDEX idx_sicas_polizas_desp_id ON sicas_polizas_vigentes(desp_id);

-- Índice en mapeo para JOINs rápidos en RLS
CREATE INDEX idx_sicas_mapeo_vendedor_movi_user
  ON sicas_mapeo_vendedor_usuario(movi_user_id);

CREATE INDEX idx_sicas_mapeo_vendedor_sicas_id
  ON sicas_mapeo_vendedor_usuario(id_sicas_vendedor);

CREATE INDEX idx_sicas_mapeo_despacho_oficina
  ON sicas_mapeo_despacho_oficina(movi_oficina_id);
```

**Impacto:** Las queries con RLS son casi tan rápidas como sin RLS gracias a los índices.

---

## Checklist de Seguridad

### ✅ Implementado

- [x] RLS habilitado en todas las tablas SICAS
- [x] Políticas específicas por rol (Administrador, Gerente, Agente)
- [x] Frontend NO hace filtrado manual, confía en RLS
- [x] Edge functions usan service role solo para sincronizaciones masivas
- [x] Índices optimizados para performance de RLS
- [x] Mapeo de usuarios a vendedores SICAS protegido por RLS
- [x] Usuarios eliminados (deleted_at IS NOT NULL) excluidos automáticamente
- [x] Vistas heredan RLS de tablas base

### 🔒 Protecciones Activas

- Usuario no puede ver datos de otros usuarios de su mismo rol
- Gerente no puede ver datos de otras oficinas
- Usuario no puede modificar mapeos de otros usuarios
- Service role solo accesible desde edge functions con autenticación
- JWT verificado por Supabase (imposible falsificar)
- auth.uid() extraído directamente del JWT (inmutable)

---

## Troubleshooting

### "Usuario no ve sus datos"

**Causa:** Falta mapeo en `sicas_mapeo_vendedor_usuario`

**Solución:**
1. Administrador crea mapeo:
   ```sql
   INSERT INTO sicas_mapeo_vendedor_usuario (movi_user_id, id_sicas_vendedor)
   VALUES ('user-uuid', 'VEND_ID_SICAS');
   ```

### "Gerente no ve datos de su oficina"

**Causa:** Falta mapeo de despachos o vendedores no asignados a oficina

**Solución:**
1. Verificar `sicas_mapeo_despacho_oficina` está poblado
2. Verificar que usuarios de la oficina tengan `oficina_id` correcto
3. Verificar que vendedores tengan mapeo en `sicas_mapeo_vendedor_usuario`

### "Performance lenta con RLS"

**Causa:** Falta índices o tabla usuarios muy grande

**Solución:**
1. Verificar que índices existan: `\d sicas_polizas_vigentes`
2. Analizar query plan: `EXPLAIN ANALYZE SELECT * FROM sicas_polizas_vigentes;`
3. Considerar materializar vista para gerentes si necesario

---

## Conclusión

El sistema SICAS está completamente protegido con RLS a nivel de base de datos. **Nunca confía en el frontend para filtrar datos sensibles.** Todas las queries son interceptadas por Postgres y filtradas automáticamente según el rol y permisos del usuario autenticado.

Esta arquitectura garantiza seguridad incluso si:
- Usuario modifica código del frontend
- Usuario hace llamadas directas a la API
- Usuario intenta inyectar SQL (imposible con Supabase)
- Usuario intenta ver datos de otros usuarios

**La seguridad está en el backend, no en el frontend.**
