// Finance OCR Backend API Integration
import { ApiResponse } from '@/types';

// Base URL configuration - UPDATE THIS TO YOUR BACKEND URL
const FINANCE_API_BASE_URL = 'http://localhost:8001';

// Types for Finance OCR API - Based on backend Pydantic models
export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

export interface OCRResult {
  doc_id: string;
  raw_text: string;
  cleaned_text: string;
  confidence: number;
}

export interface ExtractedInvoiceData {
  vendor?: string;
  invoice_number?: string;
  date?: string;
  line_items: LineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  confidence_scores: Record<string, number>;
}

export interface AIExtractionResponse {
  doc_id: string;
  extracted_data: ExtractedInvoiceData;
  overall_confidence: number;
}

export interface ApproveInvoiceRequest {
  doc_id: string;
  vendor: string;
  invoice_number: string;
  date: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  approved_by?: string;
}

export interface ApproveInvoiceResponse {
  success: boolean;
  invoice_id: string;
}

export interface InvoiceRecord {
  id: string;
  vendor: string;
  invoice_number: string;
  date: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  metadata: {
    status: string;
    source_doc_id: string;
    created_at: string;
    approved_by?: string;
  };
}

export interface InvoiceListResponse {
  invoices: InvoiceRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface RAGQueryRequest {
  query: string;
  context_type: 'invoices' | 'documents' | 'all';
  limit?: number;
}

export interface RAGReference {
  id: string;
  type: 'document' | 'invoice';
  relevance_score: number;
  snippet: string;
}

export interface RAGQueryResponse {
  answer: string;
  references: RAGReference[];
  confidence: number;
}

export interface InvoiceStats {
  total_count: number;
  total_amount: number;
  average_amount: number;
  unique_vendors: number;
  top_vendors: Array<{
    vendor: string;
    count: number;
    amount: number;
  }>;
}

export interface DocumentPreview {
  doc_id: string;
  file_name: string;
  file_type: string;
  confidence_score: number;
  raw_text_preview: string;
  cleaned_text_preview: string;
  text_length: {
    raw_text: number;
    cleaned_text: number;
  };
}

// Utility function to handle API errors
const handleApiError = async (response: Response): Promise<never> => {
  const errorText = await response.text();
  let errorMessage = `Server error: ${response.status}`;

  try {
    const errorJson = JSON.parse(errorText);
    errorMessage = errorJson.error || errorJson.detail || errorMessage;
  } catch {
    errorMessage = errorText || errorMessage;
  }

  throw new Error(errorMessage);
};

// Finance OCR API Service
export const financeApi = {
  /**
   * OCR Endpoints
   */

  // Extract text from uploaded file using OCR
  async extractText(file: File): Promise<OCRResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${FINANCE_API_BASE_URL}/ocr/extract`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Batch extract multiple files
  async batchExtract(files: File[]): Promise<OCRResult[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${FINANCE_API_BASE_URL}/ocr/batch-extract`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * AI Extraction Endpoints
   */

  // Extract structured data from document using AI
  async extractInvoiceData(docId: string): Promise<AIExtractionResponse> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/ai/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doc_id: docId }),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Extract with custom context
  async extractWithContext(docId: string, contextText?: string): Promise<AIExtractionResponse> {
    const url = new URL(`${FINANCE_API_BASE_URL}/ai/extract-with-context`);
    if (contextText) {
      url.searchParams.append('context_text', contextText);
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doc_id: docId }),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Get document preview for AI extraction
  async getDocumentPreview(docId: string): Promise<DocumentPreview> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/ai/document/${docId}/preview`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Reprocess document with improved extraction
  async reprocessDocument(docId: string): Promise<AIExtractionResponse> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/ai/reprocess/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * Invoice Management Endpoints
   */

  // Approve and store an invoice
  async approveInvoice(invoiceData: ApproveInvoiceRequest): Promise<ApproveInvoiceResponse> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // List all approved invoices with pagination
  async getInvoices(page = 1, limit = 10, vendor?: string): Promise<InvoiceListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (vendor) {
      params.append('vendor', vendor);
    }

    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Get specific invoice by ID
  async getInvoice(invoiceId: string): Promise<InvoiceRecord> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  // Export invoices as CSV
  async exportInvoicesCSV(): Promise<Blob> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/export/csv`, {
      method: 'GET',
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.blob();
  },

  // Export invoices as Excel
  async exportInvoicesExcel(): Promise<Blob> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/export/excel`, {
      method: 'GET',
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.blob();
  },

  // Get invoice statistics summary
  async getInvoiceStats(): Promise<InvoiceStats> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/invoices/stats/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * RAG Query Endpoints
   */

  // Query documents and invoices using natural language
  async ragQuery(queryData: RAGQueryRequest): Promise<RAGQueryResponse> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryData),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * Health Check
   */

  // Test backend connectivity
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${FINANCE_API_BASE_URL}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Get health status
  async getHealth(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${FINANCE_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  }
};

// Export the base URL for configuration
export { FINANCE_API_BASE_URL };