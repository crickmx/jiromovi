import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageChange: (file: File | null) => void;
  label: string;
  description?: string;
  aspectRatio?: string;
  maxSizeMB?: number;
}

export function ImageUploader({
  currentImageUrl,
  onImageChange,
  label,
  description,
  aspectRatio = 'aspect-square',
  maxSizeMB = 2
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setPreview(null);
      onImageChange(null);
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`La imagen no debe superar ${maxSizeMB}MB`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onImageChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-slate-600 mb-3">{description}</p>
      )}

      <div
        className={`relative border-2 border-dashed rounded-lg transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {preview ? (
          <div className="relative p-4">
            <div className={`${aspectRatio} w-full max-w-xs mx-auto relative rounded-lg overflow-hidden bg-slate-100`}>
              <img
                src={preview}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 text-center cursor-pointer"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Upload className="w-4 h-4" />
                <span>Arrastra una imagen o haz clic para seleccionar</span>
              </div>
              <p className="text-xs text-slate-500">
                PNG, JPG, GIF hasta {maxSizeMB}MB
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
      </div>
    </div>
  );
}
