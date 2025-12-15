import { supabase } from './supabase';

export type MatchMethod = 'direct_email' | 'mapping_email' | 'mapping_name' | 'none';

export interface UserMatchResult {
  movi_user_id: string | null;
  match_method: MatchMethod;
  vendor_key: string;
  vendor_name_norm: string;
  vendor_email_norm: string;
}

export class UserMatchingService {
  static normalizeEmail(email: string | null | undefined): string {
    if (!email) return '';
    return email.toLowerCase().trim();
  }

  static normalizeName(name: string | null | undefined): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  static buildVendorKey(emailNorm?: string, nameNorm?: string): string {
    if (emailNorm) return `email:${emailNorm}`;
    if (nameNorm) return `name:${nameNorm}`;
    return 'unknown';
  }

  static async findUserMatch({
    vendorEmailRaw,
    vendorNameRaw,
  }: {
    vendorEmailRaw?: string | null;
    vendorNameRaw?: string | null;
  }): Promise<UserMatchResult> {
    const vendor_email_norm = this.normalizeEmail(vendorEmailRaw);
    const vendor_name_norm = this.normalizeName(vendorNameRaw);
    const vendor_key = this.buildVendorKey(vendor_email_norm, vendor_name_norm);

    let movi_user_id: string | null = null;
    let match_method: MatchMethod = 'none';

    if (vendor_email_norm) {
      const { data: userByEmail } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', vendor_email_norm)
        .maybeSingle();

      if (userByEmail) {
        movi_user_id = userByEmail.id;
        match_method = 'direct_email';
        return { movi_user_id, match_method, vendor_key, vendor_name_norm, vendor_email_norm };
      }

      const { data: mappingByEmail } = await supabase
        .from('vendor_mappings')
        .select('movi_user_id')
        .eq('source_type', 'email')
        .eq('source_value', vendor_email_norm)
        .eq('status', 'active')
        .maybeSingle();

      if (mappingByEmail) {
        movi_user_id = mappingByEmail.movi_user_id;
        match_method = 'mapping_email';
        return { movi_user_id, match_method, vendor_key, vendor_name_norm, vendor_email_norm };
      }
    }

    if (vendor_name_norm) {
      const { data: mappingByName } = await supabase
        .from('vendor_mappings')
        .select('movi_user_id')
        .eq('source_type', 'name')
        .eq('source_value', vendor_name_norm)
        .eq('status', 'active')
        .maybeSingle();

      if (mappingByName) {
        movi_user_id = mappingByName.movi_user_id;
        match_method = 'mapping_name';
        return { movi_user_id, match_method, vendor_key, vendor_name_norm, vendor_email_norm };
      }
    }

    return { movi_user_id, match_method, vendor_key, vendor_name_norm, vendor_email_norm };
  }

  static async saveVendorMapping({
    sourceType,
    sourceValue,
    moviUserId,
  }: {
    sourceType: 'email' | 'name';
    sourceValue: string;
    moviUserId: string;
  }): Promise<void> {
    await supabase
      .from('vendor_mappings')
      .upsert(
        {
          source_type: sourceType,
          source_value: sourceValue,
          movi_user_id: moviUserId,
          status: 'active',
        },
        {
          onConflict: 'source_type,source_value',
        }
      );
  }
}
