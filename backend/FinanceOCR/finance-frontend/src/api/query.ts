import { apiClient } from './client';
import type { RAGQueryRequest, RAGQueryResponse } from '../types/invoice';

export const queryApi = {
  // Perform RAG query
  ask: async (queryData: RAGQueryRequest): Promise<RAGQueryResponse> => {
    const response = await apiClient.post<RAGQueryResponse>('/query/', queryData);
    return response.data;
  },

  // Find similar documents
  findSimilar: async (queryData: RAGQueryRequest): Promise<Array<{
    doc_id: string;
    similarity_score: number;
    excerpt: string;
    metadata: any;
  }>> => {
    const response = await apiClient.post('/query/similar-documents', queryData);
    return response.data;
  },

  // Get suggested queries
  getSuggestions: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>('/query/suggestions');
    return response.data;
  },

  // Explain query processing
  explain: async (queryData: RAGQueryRequest): Promise<{
    query_analysis: string;
    search_strategy: string;
    processing_steps: string[];
  }> => {
    const response = await apiClient.post('/query/explain', queryData);
    return response.data;
  },
};