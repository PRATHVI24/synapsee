import { apiClient } from './client';
import type { AIExtractionResponse } from '../types/invoice';

export const aiApi = {
  // Extract structured data from document
  extractData: async (docId: string): Promise<AIExtractionResponse> => {
    const response = await apiClient.post<AIExtractionResponse>('/ai/extract', {
      doc_id: docId,
    });

    return response.data;
  },

  // Extract with custom context
  extractWithContext: async (docId: string, context: string): Promise<AIExtractionResponse> => {
    const response = await apiClient.post<AIExtractionResponse>('/ai/extract-with-context', {
      doc_id: docId,
      context,
    });

    return response.data;
  },

  // Get document preview
  getDocumentPreview: async (docId: string): Promise<{ text: string; metadata: any }> => {
    const response = await apiClient.get(`/ai/document/${docId}/preview`);
    return response.data;
  },

  // Reprocess document with improved extraction
  reprocessDocument: async (docId: string): Promise<AIExtractionResponse> => {
    const response = await apiClient.post<AIExtractionResponse>(`/ai/reprocess/${docId}`);
    return response.data;
  },
};