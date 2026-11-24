// ============================================================
// SICAS SOAP Contract Definitions (Centralized)
// ============================================================
//
// SICAS WS_SICASOnline.asmx exposes these SOAP methods:
//
// 1. ProcesarWS - Reports/Queries (read-only)
//    Uses: KeyProcess, KeyCode, Page, ItemForPage, ConditionsAdd
//    NO PropertyTypeData involved.
//
// 2. Procesar_String - Entity Creation/Save
//    Uses: PropertyTypeProcess, PropertyTypeData (ONLY for contacts)
//    For documents: PropertyTypeData must be OMITTED.
//
// 3. ReadInfoData - Catalog reads
//    Uses: PropertyTypeReadData (enum values like eContactos, eDespachos)
//
// 4. AutentificarWS - Auth test only
//
// ============================================================

// The ONLY valid PropertyTypeData value proven to work in production.
// SICAS rejects WS_Poliza, WS_Documentos, and any other WS_* value
// in the EnumTypeData field except this one.
export const VALID_PROPERTY_TYPE_DATA = "WS_Contactos" as const;

// Valid PropertyTypeProcess values
export const VALID_PROPERTY_TYPE_PROCESS = {
  SAVE_DATA: "WS_SaveData",
} as const;

// Valid PropertyWhatMakeExist values (for contact dedup behavior)
export const VALID_WHAT_MAKE_EXIST = {
  USE_NO_UPDATE: "WS_UsarloNoUpdate",
  USE_AND_UPDATE: "WS_UsarloYUpdate",
} as const;

// Valid PropertyVerifyContact values (contact identity check)
export const VALID_VERIFY_CONTACT = {
  FULL_NAME: "WS_NombreCompleto",
  RFC: "WS_RFC",
} as const;

// SOAP Actions
export const SOAP_ACTIONS = {
  PROCESAR_STRING: "http://tempuri.org/Procesar_String",
  PROCESAR_WS: "http://tempuri.org/ProcesarWS",
  READ_INFO_DATA: "http://tempuri.org/ReadInfoData",
  AUTENTIFICAR_WS: "http://tempuri.org/AutentificarWS",
} as const;

// Contract types for different SICAS operations
export type SicasOperationType = "contact_save" | "document_save" | "report_query" | "catalog_read";

/**
 * Validates that a value is NOT an invalid WS_* operation name being used as EnumTypeData.
 * Only WS_Contactos is valid. All others (WS_Poliza, WS_Documentos, etc.) will be rejected
 * by SICAS with: "'X' no es un valor válido para EnumTypeData"
 */
export function assertValidPropertyTypeData(value: string, callerContext: string): void {
  if (value !== VALID_PROPERTY_TYPE_DATA) {
    throw new Error(
      `[${callerContext}] Contrato SOAP invalido: PropertyTypeData/EnumTypeData ` +
      `no puede recibir "${value}". ` +
      `El unico valor valido es "${VALID_PROPERTY_TYPE_DATA}". ` +
      `Para documentos/polizas, PropertyTypeData no debe enviarse en el XML.`
    );
  }
}

/**
 * Defensive guard: blocks any WS_* value from being sent as TypeData/EnumTypeData
 * except the proven valid one (WS_Contactos).
 */
export function guardAgainstInvalidTypeData(value: string | undefined, callerContext: string): void {
  if (!value) return; // undefined/null means field won't be sent (correct for documents)
  if (value.startsWith("WS_") && value !== VALID_PROPERTY_TYPE_DATA) {
    throw new Error(
      `[${callerContext}] BLOQUEADO: Se intento enviar "${value}" como PropertyTypeData. ` +
      `Valores WS_* (excepto WS_Contactos) no son validos para EnumTypeData de SICAS. ` +
      `Para operaciones de documentos/polizas, NO enviar PropertyTypeData.`
    );
  }
}

/**
 * Builds the oConfigData XML block for contact creation.
 * This is the ONLY operation that uses PropertyTypeData.
 */
export function buildContactConfigData(): string {
  return `<tem:oConfigData>
        <tem:PropertyTypeProcess>${VALID_PROPERTY_TYPE_PROCESS.SAVE_DATA}</tem:PropertyTypeProcess>
        <tem:PropertyTypeData>${VALID_PROPERTY_TYPE_DATA}</tem:PropertyTypeData>
        <tem:PropertyWhatMakeExist>${VALID_WHAT_MAKE_EXIST.USE_NO_UPDATE}</tem:PropertyWhatMakeExist>
        <tem:PropertyVerifyContact>${VALID_VERIFY_CONTACT.FULL_NAME}</tem:PropertyVerifyContact>
      </tem:oConfigData>`;
}

/**
 * Builds the oConfigData XML block for document/policy registration.
 * Does NOT include PropertyTypeData (SICAS rejects all WS_* values for documents).
 * The entity type is determined by the DatDocumentos.* field prefix in oDataString.
 */
export function buildDocumentConfigData(): string {
  return `<tem:oConfigData>
        <tem:PropertyTypeProcess>${VALID_PROPERTY_TYPE_PROCESS.SAVE_DATA}</tem:PropertyTypeProcess>
      </tem:oConfigData>`;
}

/**
 * Logs SOAP request metadata for debugging (never logs credentials or full XML).
 */
export function logSoapRequest(context: string, params: {
  method: string;
  endpoint: string;
  propertyTypeProcess?: string;
  propertyTypeData?: string | null;
  keyCode?: string;
  fieldCount?: number;
  fieldNames?: string[];
}): void {
  console.log(`[${context}] SOAP Method: ${params.method}`);
  console.log(`[${context}] Endpoint: ${params.endpoint}`);
  if (params.propertyTypeProcess) {
    console.log(`[${context}] PropertyTypeProcess: ${params.propertyTypeProcess}`);
  }
  if (params.propertyTypeData) {
    console.log(`[${context}] PropertyTypeData: ${params.propertyTypeData}`);
  } else if (params.propertyTypeData === null) {
    console.log(`[${context}] PropertyTypeData: (omitted - document contract)`);
  }
  if (params.keyCode) {
    console.log(`[${context}] KeyCode: ${params.keyCode}`);
  }
  if (params.fieldCount !== undefined) {
    console.log(`[${context}] Fields count: ${params.fieldCount}`);
  }
  if (params.fieldNames?.length) {
    console.log(`[${context}] Field names: ${params.fieldNames.join(", ")}`);
  }
}
