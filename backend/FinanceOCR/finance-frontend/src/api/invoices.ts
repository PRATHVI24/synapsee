import { api } from './axios';
import type {
  OCRResult,
  AIExtractionResponse,
  ApproveInvoiceRequest,
  ApproveInvoiceResponse,
  InvoiceListResponse,
  RAGQueryRequest,
  RAGQueryResponse,
  InvoiceStats,
  Invoice,
} from '@/types/invoice';

// OCR Endpoints
export const ocrExtract = async (file: File): Promise<OCRResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/ocr/extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const batchOcrExtract = async (files: File[]): Promise<OCRResult[]> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post('/ocr/batch-extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// AI Extraction Endpoints
export const aiExtract = async (docId: string): Promise<AIExtractionResponse> => {
  const response = await api.post('/ai/extract', { doc_id: docId });
  return response.data;
};

export const aiExtractWithContext = async (
  docId: string,
  contextText?: string
): Promise<AIExtractionResponse> => {
  const response = await api.post(
    `/ai/extract-with-context?context_text=${encodeURIComponent(contextText || '')}`,
    { doc_id: docId }
  );
  return response.data;
};

export const previewDocument = async (docId: string) => {
  const response = await api.get(`/ai/document/${docId}/preview`);
  return response.data;
};

export const reprocessDocument = async (docId: string): Promise<AIExtractionResponse> => {
  const response = await api.post(`/ai/reprocess/${docId}`);
  return response.data;
};

// Invoice Management Endpoints
export const approveInvoice = async (
  invoiceData: ApproveInvoiceRequest
): Promise<ApproveInvoiceResponse> => {
  const response = await api.post('/invoices/approve', invoiceData);
  return response.data;
};

export const getInvoices = async (
  page = 1,
  limit = 10,
  vendor?: string
): Promise<InvoiceListResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (vendor) {
    params.append('vendor', vendor);
  }

  const response = await api.get(`/invoices/?${params.toString()}`);
  return response.data;
};

export const getInvoice = async (invoiceId: string): Promise<Invoice> => {
  const response = await api.get(`/invoices/${invoiceId}`);
  return response.data;
};

export const exportInvoicesCSV = async (): Promise<Blob> => {
  const response = await api.get('/invoices/export/csv', {
    responseType: 'blob',
  });
  return response.data;
};

export const exportInvoicesExcel = async (): Promise<Blob> => {
  const response = await api.get('/invoices/export/excel', {
    responseType: 'blob',
  });
  return response.data;
};

export const getInvoiceStats = async (): Promise<InvoiceStats> => {
  const response = await api.get('/invoices/stats/summary');
  return response.data;
};

// RAG Query Endpoints
export const ragQuery = async (queryData: RAGQueryRequest): Promise<RAGQueryResponse> => {
  const response = await api.post('/query/', queryData);
  return response.data;
};

export const findSimilarDocuments = async (queryData: RAGQueryRequest) => {
  const response = await api.post('/query/similar-documents', queryData);
  return response.data;
};

export const getQuerySuggestions = async () => {
  const response = await api.get('/query/suggestions');
  return response.data;
};

export const explainQuery = async (queryData: RAGQueryRequest) => {
  const response = await api.post('/query/explain', queryData);
  return response.data;
};

// Health Check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};