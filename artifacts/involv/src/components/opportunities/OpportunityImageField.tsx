import { useEffect, useState } from 'react';
import { ImagePlusIcon, XIcon } from 'lucide-react';
import {
  MAX_OPPORTUNITY_IMAGE_BYTES,
  validateOpportunityImage,
} from '../../services/opportunityImageService';

interface OpportunityImageFieldProps {
  currentImageUrl?: string | null;
  file: File | null;
  removeCurrentImage?: boolean;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onRemoveCurrentImageChange?: (remove: boolean) => void;
}

export default function OpportunityImageField({
  currentImageUrl,
  file,
  removeCurrentImage = false,
  disabled = false,
  onFileChange,
  onRemoveCurrentImageChange,
}: OpportunityImageFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const visibleImage = previewUrl || (!removeCurrentImage ? currentImageUrl : null);

  const chooseFile = (selected: File | undefined) => {
    setError(null);
    if (!selected) return;
    const validationError = validateOpportunityImage(selected);
    if (validationError) {
      onFileChange(null);
      setError(validationError);
      return;
    }
    onRemoveCurrentImageChange?.(false);
    onFileChange(selected);
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center shrink-0">
          <ImagePlusIcon size={15} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Listing image (optional)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Add a JPG, PNG or WebP image up to 5 MB. Images on published listings are public.
            Do not upload identifiable student photos unless the school has approved them.
          </p>
        </div>
      </div>

      {visibleImage && (
        <img
          src={visibleImage}
          alt="Preview of the opportunity listing image"
          className="mb-4 w-full max-h-64 rounded-xl object-cover bg-slate-100"
        />
      )}
      {file && <p className="text-xs text-slate-500 mb-3 truncate">{file.name}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <label className={`btn-secondary inline-flex items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          <ImagePlusIcon size={14} />
          {file || visibleImage ? 'Choose another image' : 'Choose image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={event => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>

        {file && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => { onFileChange(null); setError(null); }}
            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <XIcon size={13} /> Clear selected file
          </button>
        )}

        {!file && currentImageUrl && !removeCurrentImage && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemoveCurrentImageChange?.(true)}
            className="text-xs text-red-700 hover:text-red-900 inline-flex items-center gap-1"
          >
            <XIcon size={13} /> Remove current image
          </button>
        )}

        {removeCurrentImage && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemoveCurrentImageChange?.(false)}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            Keep current image
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
      <p className="text-[11px] text-slate-400 mt-2">
        Maximum file size: {MAX_OPPORTUNITY_IMAGE_BYTES / 1024 / 1024} MB.
      </p>
    </div>
  );
}
