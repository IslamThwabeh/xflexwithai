import { Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept: string;
  maxSize?: number; // in MB
  onUpload: (file: File) => Promise<string>; // Returns URL
  onUrlChange: (url: string) => void;
  currentUrl?: string;
  label: string;
  preview?: "image" | "video" | "none";
  className?: string;
}

export function FileUpload({
  accept,
  maxSize = 100, // Default 100MB
  onUpload,
  onUrlChange,
  currentUrl,
  label,
  preview = "none",
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      // Simulate progress (since we don't have real progress from S3)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const url = await onUpload(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      setUploadedUrl(url);
      onUrlChange(url);

      // Reset progress after a delay
      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = () => {
    setUploadedUrl(null);
    onUrlChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium">{label}</label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {!uploadedUrl && !uploading && (
        <div
          onClick={handleClick}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            {accept.split(",").join(", ")} (max {maxSize}MB)
          </p>
        </div>
      )}

      {uploading && (
        <div className="border rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Uploading...</span>
            </div>
            <span className="text-sm text-gray-600">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {uploadedUrl && !uploading && (
        <div className="space-y-3">
          <div className="border rounded-lg p-4 flex items-center justify-between bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                Upload successful
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {preview === "image" && (
            <div className="border rounded-lg overflow-hidden">
              <img
                src={uploadedUrl}
                alt="Preview"
                className="w-full max-h-64 object-contain bg-black/5"
              />
            </div>
          )}

          {preview === "video" && (
            <div className="border rounded-lg overflow-hidden">
              <video
                src={uploadedUrl}
                controls
                className="w-full h-48 object-cover"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadedUrl ? "Change File" : "Select File"}
        </Button>
      )}
    </div>
  );
}
