"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, X, Upload } from "lucide-react";

interface ImageUploadProps {
  value: string | null;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
  className?: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB — matches gear-images bucket

export function ImageUpload({ value, onFileSelected, onRemove, className = "" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = preview || value;

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Use JPG, PNG, or WebP");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("Image must be under 10 MB");
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setPreview(null);
    setError(null);
    onRemove();
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleInputChange}
        className="hidden"
      />

      {displayUrl ? (
        <div className="relative group w-full">
          <img
            src={displayUrl}
            alt="Item photo"
            className="h-32 w-full rounded-xl object-cover border border-border"
          />
          <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm hover:bg-white transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm hover:bg-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-surface-secondary"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary">
            {dragOver ? (
              <Upload className="h-5 w-5 text-primary" />
            ) : (
              <Camera className="h-5 w-5 text-text-tertiary" />
            )}
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-text-secondary">
              {dragOver ? "Drop image here" : "Add a photo"}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">
              JPG, PNG, or WebP up to 10 MB
            </p>
          </div>
        </button>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
