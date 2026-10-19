import { supabase } from '../lib/supabase';

export const OPPORTUNITY_IMAGE_BUCKET = 'involv-opportunity-images';
export const MAX_OPPORTUNITY_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export function opportunityImagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(OPPORTUNITY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function validateOpportunityImage(file: File): string | null {
  if (!Object.prototype.hasOwnProperty.call(IMAGE_TYPES, file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (file.size > MAX_OPPORTUNITY_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  if (file.size === 0) return 'That image file is empty.';
  return null;
}

export async function uploadOpportunityImage(userId: string, file: File): Promise<string> {
  const validationError = validateOpportunityImage(file);
  if (validationError) throw new Error(validationError);

  const extension = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(OPPORTUNITY_IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error('The image could not be uploaded. Check that the Involv image-storage setup has been applied.');
  return path;
}

export async function removeOpportunityImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(OPPORTUNITY_IMAGE_BUCKET).remove([path]);
  if (error) throw new Error('The image could not be removed from storage.');
}
