// HL7 Backend API Integration
import { ApiResponse } from '@/types';

// Base URL configuration - UPDATE THIS TO YOUR BACKEND URL
const HL7_API_BASE_URL = 'http://localhost:8000';

// Types for HL7 API responses
export interface HL7TextResult {
  summary: string;
  details: Record<string, string>;
}

export interface HL7ExtractedData {
  patient_name: string;
  patient_id: string;
  dob: string;
  gender: string;
  ordering_physician: string;
  tests: string[];
  diagnosis: string;
  order_date: string;
}

export interface PDFToHL7Response {
  extracted_data: HL7ExtractedData;
  hl7_message: string;
  pdf_text: string;
}

export interface OCRResults {
  tesseract: string;
  easyocr: string;
  paddleocr: string;
  combined: string;
  confidence: number;
}

export interface OCRProcessResponse {
  ocr_results: OCRResults;
  hl7_message: string;
  extracted_data: HL7ExtractedData;
}

// Utility function to handle API errors
const handleApiError = async (response: Response): Promise<never> => {
  const errorText = await response.text();
  let errorMessage = `Server error: ${response.status}`;

  try {
    const errorJson = JSON.parse(errorText);
    errorMessage = errorJson.detail || errorMessage;
  } catch {
    errorMessage = errorText || errorMessage;
  }

  throw new Error(errorMessage);
};

// HL7 API Service
export const hl7Api = {
  /**
   * Convert HL7 message to natural language
   */
  async convertHL7ToText(hl7Message: string): Promise<HL7TextResult> {
    const formData = new FormData();
    formData.append('message', hl7Message);

    const response = await fetch(`${HL7_API_BASE_URL}/api/hl7-to-text`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * Convert PDF lab order to HL7
   */
  async convertPDFToHL7(file: File): Promise<PDFToHL7Response> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${HL7_API_BASE_URL}/api/pdf-to-hl7`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * Process image with multi-engine OCR and convert to HL7
   */
  async processOCR(file: File): Promise<OCRProcessResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${HL7_API_BASE_URL}/api/ocr-process`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  },

  /**
   * Test backend connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${HL7_API_BASE_URL}/`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

// Export the base URL for configuration
export { HL7_API_BASE_URL };