# UI: Vendedores No Reconocidos - Especificación

## Estado: PENDIENTE DE IMPLEMENTACIÓN

Esta especificación detalla cómo debe implementarse la sección de "Vendedores No Reconocidos" en la página ComisionesLote para soportar el formato LOGEXPORT.

---

## Ubicación

**Página:** `src/pages/ComisionesLote.tsx`
**Sección:** Nueva tab "Pendientes" o sección dentro de "Resumen"

---

## Funcionalidad Requerida

### 1. Cargar Vendedores No Reconocidos

Al cargar el lote, verificar si tiene items pendientes:

```typescript
// En loadBatch()
const { data: batch } = await supabase
  .from('commission_batches')
  .select('*, has_pending_assignments, pending_count')
  .eq('id', id)
  .single();

if (batch?.has_pending_assignments) {
  loadUnrecognizedVendors();
}
```

### 2. Llamar Edge Function

```typescript
const loadUnrecognizedVendors = async () => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-unrecognized-vendors?batch_id=${id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      setUnrecognizedVendors(result.vendors);
      setTotalUnrecognized({
        vendors: result.total_vendors,
        items: result.total_items,
        commission: result.total_commission
      });
    }
  } catch (error) {
    console.error('Error loading unrecognized vendors:', error);
  }
};
```

---

## 3. UI: Tabla de Vendedores No Reconocidos

### Layout

```tsx
{batch?.has_pending_assignments && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-yellow-600" />
        <div>
          <h3 className="font-semibold text-gray-900">
            Vendedores No Reconocidos
          </h3>
          <p className="text-sm text-gray-600">
            {totalUnrecognized.vendors} vendedores • {totalUnrecognized.items} items •
            {formatCurrency(totalUnrecognized.commission)} total
          </p>
        </div>
      </div>
      <button
        onClick={() => setShowUnrecognizedModal(true)}
        className="btn-primary"
      >
        Asignar Vendedores
      </button>
    </div>

    {/* Tabla */}
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Nombre Vendedor
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Items
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Comisión Total
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {unrecognizedVendors.map((vendor) => (
            <tr key={vendor.vendor_key} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {vendor.vendor_name_raw || vendor.vendor_key}
                  </div>
                  <div className="text-sm text-gray-500">
                    {vendor.vendor_key}
                  </div>
                  {vendor.has_existing_mapping && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      Mapping existente
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-gray-900">
                {vendor.items_count}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatCurrency(vendor.total_commission)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => openAssignModal(vendor)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Asignar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

---

## 4. Modal de Asignación

### Componente: `AsignarVendedorModal.tsx`

```tsx
interface AsignarVendedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: UnrecognizedVendor;
  batchId: string;
  onSuccess: () => void;
}

export default function AsignarVendedorModal({
  isOpen,
  onClose,
  vendor,
  batchId,
  onSuccess
}: AsignarVendedorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Buscar usuarios MOVI
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers(searchQuery);
    }
  }, [searchQuery]);

  const searchUsers = async (query: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, office:office_id(nombre)')
        .or(`nombre.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('rol', 'Administrador')
        .order('nombre')
        .limit(10);

      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) return;

    setAssigning(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assign-vendor-manual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            batch_id: batchId,
            vendor_key: vendor.vendor_key,
            movi_user_id: selectedUser.id
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert('Error al asignar: ' + result.error);
      }
    } catch (error) {
      console.error('Error assigning vendor:', error);
      alert('Error al asignar vendedor');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Asignar Vendedor">
      <div className="space-y-6">
        {/* Info del Vendedor */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            {vendor.vendor_name_raw || vendor.vendor_key}
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Items: {vendor.items_count}</div>
            <div>Comisión: {formatCurrency(vendor.total_commission)}</div>
            <div className="text-xs font-mono text-gray-500">
              {vendor.vendor_key}
            </div>
          </div>
        </div>

        {/* Búsqueda de Usuario */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar Usuario MOVI
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre o email del agente..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            autoFocus
          />
        </div>

        {/* Lista de Usuarios */}
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedUser?.id === user.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{user.nombre}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                {user.office && (
                  <div className="text-xs text-gray-400 mt-1">
                    {user.office.nombre}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && searchQuery.length >= 2 && users.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No se encontraron usuarios
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={assigning}
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUser || assigning}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {assigning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Asignando...
              </>
            ) : (
              'Asignar'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
```

---

## 5. Actualización Después de Asignar

Después de asignar exitosamente, recargar el lote:

```typescript
const onAssignSuccess = async () => {
  // Recargar vendedores no reconocidos
  await loadUnrecognizedVendors();

  // Recargar details del lote
  await loadBatch();

  // Mostrar mensaje de éxito
  alert('Vendedor asignado exitosamente');
};
```

---

## 6. Indicador Visual en el Lote

Mostrar badge si hay items pendientes:

```tsx
<div className="flex items-center gap-2">
  <h1 className="text-2xl font-bold text-gray-900">
    {batch?.name}
  </h1>

  {batch?.has_pending_assignments && (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
      {batch.pending_count} pendientes
    </span>
  )}
</div>
```

---

## 7. Estados y Tipos

```typescript
interface UnrecognizedVendor {
  vendor_key: string;
  vendor_name_raw: string | null;
  vendor_email_raw: string | null;
  items_count: number;
  total_commission: number;
  has_existing_mapping: boolean;
}

interface TotalUnrecognized {
  vendors: number;
  items: number;
  commission: number;
}

// En el componente
const [unrecognizedVendors, setUnrecognizedVendors] = useState<UnrecognizedVendor[]>([]);
const [totalUnrecognized, setTotalUnrecognized] = useState<TotalUnrecognized>({
  vendors: 0,
  items: 0,
  commission: 0
});
const [showAssignModal, setShowAssignModal] = useState(false);
const [selectedVendor, setSelectedVendor] = useState<UnrecognizedVendor | null>(null);
```

---

## 8. Flujo Completo

```
1. Usuario navega a ComisionesLote/{batch_id}
2. loadBatch() detecta has_pending_assignments = true
3. Llama a loadUnrecognizedVendors()
4. Muestra sección amarilla con tabla de vendedores
5. Usuario click en "Asignar" para un vendedor
6. Abre modal AsignarVendedorModal
7. Usuario busca agente MOVI
8. Usuario selecciona agente
9. Usuario confirma
10. Modal llama a assign-vendor-manual edge function
11. Edge function actualiza items y crea mapping persistente
12. Modal cierra y recarga datos
13. Vendedor desaparece de "No Reconocidos"
14. Items ahora tienen agent_id asignado
15. Badge de pendientes se actualiza
```

---

## 9. Consideraciones de UX

### Búsqueda Inteligente
- Sugerir usuarios con nombre similar al vendor_name_raw
- Highlight de coincidencias en nombre
- Mostrar historial de assignments recientes

### Confirmación
- Mostrar resumen antes de asignar:
  - "Vas a asignar 45 items ($12,500) a Juan Pérez"
- Opción de "No volver a preguntar para este vendedor"

### Feedback
- Loading states claros durante asignación
- Toast de éxito con detalles
- Actualización automática de contadores

### Errors Handling
- Mensaje claro si el usuario no existe
- Mensaje claro si el lote no tiene items pendientes
- Reintento automático si falla la petición

---

## 10. Testing de UI

### Casos a Verificar

1. **Lote con pendientes:**
   - Sección amarilla visible
   - Tabla muestra vendedores correctamente
   - Contadores correctos

2. **Lote sin pendientes:**
   - Sección no aparece
   - No hay badge de pendientes

3. **Asignación exitosa:**
   - Modal se cierra
   - Datos se recargan
   - Vendedor desaparece de la lista
   - Badge se actualiza

4. **Búsqueda de usuarios:**
   - Resultados aparecen al escribir
   - Loading state correcto
   - "No se encontraron" cuando aplica

5. **Errores:**
   - Mensaje claro si falla asignación
   - No se pierde el estado del modal

---

## 11. Archivos a Modificar/Crear

### Modificar
- `src/pages/ComisionesLote.tsx` - Agregar sección y lógica

### Crear
- `src/components/comisiones/AsignarVendedorModal.tsx` - Nuevo modal
- `src/components/comisiones/VendedoresNoReconocidos.tsx` - Nueva tabla (opcional, puede ir en ComisionesLote)

---

## Prioridad de Implementación

**Alta:** Esta funcionalidad es crítica para el soporte completo de formato LOGEXPORT.

**Estimación:** 4-6 horas de desarrollo + testing

**Dependencias:**
- ✅ Edge functions ya están creadas y funcionando
- ✅ Base de datos ya está configurada
- ✅ Backend completamente funcional

**Bloqueadores:** Ninguno - Solo falta la UI

---

## Checklist de Implementación

- [ ] Agregar estados y tipos en ComisionesLote
- [ ] Agregar loadUnrecognizedVendors() function
- [ ] Agregar sección visual con tabla
- [ ] Crear AsignarVendedorModal component
- [ ] Implementar búsqueda de usuarios
- [ ] Implementar asignación con edge function
- [ ] Agregar badge de pendientes
- [ ] Testing completo con archivo real
- [ ] Verificar recarga de datos después de asignar
- [ ] Verificar contadores se actualizan

---

## Resultado Esperado

Usuario podrá:
1. Ver claramente qué vendedores no están reconocidos
2. Buscar y asignar usuarios MOVI de manera intuitiva
3. Ver feedback inmediato de la asignación
4. Confiar en que el mapping se guardará para futuras importaciones
5. Procesar completamente archivos LOGEXPORT sin intervención manual repetitiva
