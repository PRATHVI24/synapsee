import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UploadFile } from '../types/invoice';

interface FileUploadProps {
  onFilesSelected: (files: UploadFile[]) => void;
  maxFiles?: number;
  className?: string;
}

const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760'); // 10MB

export function FileUpload({ onFilesSelected, maxFiles = 5, className }: FileUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      console.warn('Some files were rejected:', rejectedFiles);
    }

    // Convert accepted files to UploadFile format
    const newUploadFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
    onFilesSelected(newUploadFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: maxFiles - uploadFiles.length,
  });

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return (
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <Card className={cn(
        'border-2 border-dashed transition-colors cursor-pointer',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        uploadFiles.length >= maxFiles && 'opacity-50 cursor-not-allowed'
      )}>
        <CardContent
          {...getRootProps()}
          className="flex flex-col items-center justify-center p-6 text-center"
        >
          <input {...getInputProps()} disabled={uploadFiles.length >= maxFiles} />

          <Upload className={cn(
            'h-12 w-12 mb-4',
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          )} />

          {isDragActive ? (
            <p className="text-lg font-medium text-primary mb-2">
              Drop files here...
            </p>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PNG, JPG, JPEG, or PDF files up to {formatFileSize(MAX_FILE_SIZE)}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploadFiles.length}/{maxFiles} files selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File list */}
      {uploadFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files</h4>
          <div className="space-y-2">
            {uploadFiles.map((uploadFile, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getStatusIcon(uploadFile.status)}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(uploadFile.file.size)}</span>
                        <span>•</span>
                        <span className="capitalize">{uploadFile.status}</span>
                      </div>
                    </div>
                  </div>

                  {uploadFile.status !== 'uploading' && uploadFile.status !== 'processing' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Progress bar for uploading/processing */}
                {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                  <div className="mt-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {uploadFile.status === 'error' && uploadFile.error && (
                  <div className="mt-2 text-xs text-red-500">
                    {uploadFile.error}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}