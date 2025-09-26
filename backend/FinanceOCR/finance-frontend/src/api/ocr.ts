import { apiClient } from './client';
import type { OCRResult } from '../types/invoice';

export const ocrApi = {
  // Extract text from uploaded file
  extractText: async (file: File): Promise<OCRResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<OCRResult>('/ocr/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Batch extract multiple files
  batchExtract: async (files: File[]): Promise<OCRResult[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await apiClient.post<OCRResult[]>('/ocr/batch-extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};