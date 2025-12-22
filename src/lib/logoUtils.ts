import { supabase } from './supabase';

export interface LogoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_DIMENSION = 1500;

/**
 * Validates logo file before upload
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Solo se permiten archivos PNG, JPG o JPEG' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'El archivo debe ser menor a 5MB' };
  }

  return { valid: true };
}

/**
 * Resizes image to max dimensions while maintaining aspect ratio
 */
async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto del canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo crear el blob de la imagen'));
          return;
        }
        const resizedFile = new File([blob], file.name, { type: file.type });
        resolve(resizedFile);
      }, file.type);
    };

    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads user's personal logo
 */
export async function uploadUserLogo(userId: string, file: File): Promise<LogoUploadResult> {
  try {
    const validation = validateLogoFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const resizedFile = await resizeImage(file, MAX_DIMENSION, MAX_DIMENSION);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/logo.${fileExt}`;

    // Delete existing logo if any
    const { data: existingFiles } = await supabase.storage
      .from('usuarios-logos')
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage
        .from('usuarios-logos')
        .remove(existingFiles.map(f => `${userId}/${f.name}`));
    }

    // Upload new logo
    const { error: uploadError } = await supabase.storage
      .from('usuarios-logos')
      .upload(fileName, resizedFile, { upsert: true });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('usuarios-logos')
      .getPublicUrl(fileName);

    // Update user record
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ mi_logotipo_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, url: publicUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Deletes user's personal logo
 */
export async function deleteUserLogo(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage
    const { data: existingFiles } = await supabase.storage
      .from('usuarios-logos')
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage
        .from('usuarios-logos')
        .remove(existingFiles.map(f => `${userId}/${f.name}`));
    }

    // Update user record
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ mi_logotipo_url: null })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Uploads office logo (admin only)
 */
export async function uploadOfficeLogo(officeId: string, file: File): Promise<LogoUploadResult> {
  try {
    const validation = validateLogoFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const resizedFile = await resizeImage(file, MAX_DIMENSION, MAX_DIMENSION);
    const fileExt = file.name.split('.').pop();
    const fileName = `${officeId}/logo.${fileExt}`;

    // Delete existing logo if any
    const { data: existingFiles } = await supabase.storage
      .from('oficinas-logos')
      .list(officeId);

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage
        .from('oficinas-logos')
        .remove(existingFiles.map(f => `${officeId}/${f.name}`));
    }

    // Upload new logo
    const { error: uploadError } = await supabase.storage
      .from('oficinas-logos')
      .upload(fileName, resizedFile, { upsert: true });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('oficinas-logos')
      .getPublicUrl(fileName);

    // Update office record
    const { error: updateError } = await supabase
      .from('oficinas')
      .update({ logo_url: publicUrl })
      .eq('id', officeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, url: publicUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Deletes office logo (admin only)
 */
export async function deleteOfficeLogo(officeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage
    const { data: existingFiles } = await supabase.storage
      .from('oficinas-logos')
      .list(officeId);

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage
        .from('oficinas-logos')
        .remove(existingFiles.map(f => `${officeId}/${f.name}`));
    }

    // Update office record
    const { error: updateError } = await supabase
      .from('oficinas')
      .update({ logo_url: null })
      .eq('id', officeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Gets effective logo for a user following hierarchy: Mi Logotipo → Logo Oficina → Logo JIRO
 */
export async function getEffectiveUserLogo(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .rpc('get_effective_user_logo', { p_user_id: userId });

    if (error) {
      console.error('Error getting effective logo:', error);
      return '/logojiro.png';
    }

    return data || '/logojiro.png';
  } catch (error) {
    console.error('Error getting effective logo:', error);
    return '/logojiro.png';
  }
}

/**
 * Gets office logo for a user (ignores personal logo)
 * Hierarchy: Logo Oficina → Logo JIRO
 */
export async function getOfficeLogo(userId: string): Promise<string> {
  try {
    // Get user's office
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('oficina_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData?.oficina_id) {
      return '/logojiro.png';
    }

    // Get office logo
    const { data: officeData, error: officeError } = await supabase
      .from('oficinas')
      .select('logo_url')
      .eq('id', userData.oficina_id)
      .maybeSingle();

    if (officeError || !officeData?.logo_url) {
      return '/logojiro.png';
    }

    return officeData.logo_url;
  } catch (error) {
    console.error('Error getting office logo:', error);
    return '/logojiro.png';
  }
}

/**
 * Counts how many users would be affected by changing an office logo
 */
export async function countUsersAffectedByOfficeLogo(officeId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('oficina_id', officeId)
      .or('mi_logotipo_url.is.null,mi_logotipo_url.eq.');

    if (error) {
      console.error('Error counting affected users:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error counting affected users:', error);
    return 0;
  }
}
