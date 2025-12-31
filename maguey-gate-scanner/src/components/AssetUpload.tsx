import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { optimizeImage, validateAssetFile, type AssetType } from '@/lib/asset-service';
import { useToast } from '@/hooks/use-toast';

interface AssetUploadProps {
  assetType: AssetType;
  label: string;
  description?: string;
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  maxSize?: number;
  accept?: string;
}

export const AssetUpload = ({
  assetType,
  label,
  description,
  currentUrl,
  onUpload,
  onDelete,
  maxSize = 10 * 1024 * 1024,
  accept,
}: AssetUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file
      const validation = validateAssetFile(file, assetType);
      if (!validation.valid) {
        toast({
          title: 'Invalid file',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }

      try {
        setUploading(true);
        setProgress(0);

        // Optimize image if it's an image
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          try {
            fileToUpload = await optimizeImage(file, 1920, 1920, 0.9);
            setProgress(50);
          } catch (error) {
            console.warn('Failed to optimize image, using original:', error);
          }
        }

        await onUpload(fileToUpload);
        setProgress(100);
        toast({
          title: 'Upload successful',
          description: `${label} uploaded successfully`,
        });
      } catch (error: any) {
        toast({
          title: 'Upload failed',
          description: error.message || 'Failed to upload file',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [assetType, label, onUpload, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept || {
      'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize,
    multiple: false,
    disabled: uploading,
  });

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      toast({
        title: 'Deleted',
        description: `${label} deleted successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {currentUrl ? (
        <div className="space-y-2">
          <div className="relative border rounded-md overflow-hidden">
            {assetType === 'favicon' || assetType.includes('logo') ? (
              <img
                src={currentUrl}
                alt={label}
                className="w-full h-32 object-contain bg-muted"
              />
            ) : (
              <div className="p-4 bg-muted flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleDelete}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Current {label.toLowerCase()} is set</span>
          </div>
        </div>
      ) : null}

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-md p-6 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploading...</p>
            <Progress value={progress} className="w-full" />
          </div>
        ) : (
          <>
            <p className="text-sm font-medium mb-1">
              {isDragActive ? 'Drop file here' : `Click or drag to upload ${label.toLowerCase()}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </>
        )}
      </div>
    </div>
  );
};

