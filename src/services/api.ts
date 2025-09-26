// API service layer with mock data for all projects

import type {
  HL7Document,
  FinanceDocument,
  Campaign,
  Call,
  Meeting,
  ApiResponse,
  ProcessingStatus,
} from '@/types';

// Utility function to simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock data generators
const generateId = () => Math.random().toString(36).substr(2, 9);

// Project 1: HL7 Medical API
export const hl7Api = {
  async uploadDocument(file: File): Promise<ApiResponse<HL7Document>> {
    await delay(1000);
    
    const document: HL7Document = {
      id: generateId(),
      filename: file.name,
      type: file.name.includes('.hl7') ? 'hl7' : 'medical_image',
      uploadedAt: new Date(),
      status: 'processing' as ProcessingStatus,
    };

    return { success: true, data: document };
  },

  async getProcessingStatus(documentId: string): Promise<ApiResponse<ProcessingStatus>> {
    await delay(500);
    const statuses: ProcessingStatus[] = ['processing', 'completed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return { success: true, data: status };
  },

  async getDocuments(): Promise<ApiResponse<HL7Document[]>> {
    await delay(800);
    
    const mockDocuments: HL7Document[] = [
      {
        id: '1',
        filename: 'patient_data.hl7',
        type: 'hl7',
        uploadedAt: new Date(Date.now() - 86400000),
        status: 'completed',
        hl7Data: {
          messageType: 'ADT^A01',
          patientInfo: {
            id: 'P123456',
            name: 'John Doe',
            dob: '1985-06-15',
            gender: 'M'
          },
          segments: []
        }
      },
      {
        id: '2',
        filename: 'medical_image.jpg',
        type: 'medical_image',
        uploadedAt: new Date(Date.now() - 172800000),
        status: 'completed',
        ocrResults: [
          {
            engine: 'google_vision',
            confidence: 0.95,
            extractedText: 'Patient: Jane Smith\nDiagnosis: Hypertension\nPrescription: Lisinopril 10mg',
            processedAt: new Date()
          }
        ]
      }
    ];

    return { success: true, data: mockDocuments };
  }
};

// Project 2: Finance OCR API
export const financeApi = {
  async uploadDocument(file: File): Promise<ApiResponse<FinanceDocument>> {
    await delay(1500);
    
    const document: FinanceDocument = {
      id: generateId(),
      filename: file.name,
      uploadedAt: new Date(),
      status: 'processing',
      extractedData: {
        documentType: 'invoice',
        amount: 1250.50,
        currency: 'USD',
        date: new Date(),
        vendor: 'ABC Company',
        items: [
          { description: 'Professional Services', amount: 1000.00 },
          { description: 'Tax', amount: 250.50 }
        ],
        confidence: 0.92
      }
    };

    return { success: true, data: document };
  },

  async getHistory(): Promise<ApiResponse<FinanceDocument[]>> {
    await delay(600);
    
    const mockHistory: FinanceDocument[] = [
      {
        id: '1',
        filename: 'invoice_2024_001.pdf',
        uploadedAt: new Date(Date.now() - 86400000),
        status: 'completed',
        extractedData: {
          documentType: 'invoice',
          amount: 2500.00,
          currency: 'USD',
          date: new Date(Date.now() - 86400000),
          vendor: 'Tech Solutions Inc',
          items: [
            { description: 'Software License', amount: 2000.00 },
            { description: 'Support Fee', amount: 500.00 }
          ],
          confidence: 0.96
        }
      }
    ];

    return { success: true, data: mockHistory };
  }
};

// Project 4: AI Outbound Sales API
export const salesApi = {
  async getCampaigns(): Promise<ApiResponse<Campaign[]>> {
    await delay(900);
    
    const mockCampaigns: Campaign[] = [
      {
        id: '1',
        name: 'Dental Practice Q1 2024',
        status: 'active',
        createdAt: new Date(Date.now() - 7 * 86400000),
        prospects: [
          {
            id: '1',
            name: 'Dr. Sarah Miller',
            company: 'Miller Dental Clinic',
            phone: '+1-555-0123',
            email: 'sarah@millerdental.com',
            status: 'interested',
            lastContact: new Date(Date.now() - 86400000)
          }
        ],
        analytics: {
          totalCalls: 45,
          successRate: 0.24,
          averageDuration: 180,
          meetingsBooked: 8,
          conversionRate: 0.18,
          topObjections: ['Budget constraints', 'Already have a system', 'Need to discuss with partner']
        }
      }
    ];

    return { success: true, data: mockCampaigns };
  },

  async getCalls(campaignId: string): Promise<ApiResponse<Call[]>> {
    await delay(600);
    
    const mockCalls: Call[] = [
      {
        id: '1',
        prospectId: '1',
        campaignId,
        startTime: new Date(Date.now() - 3600000),
        duration: 240,
        status: 'completed',
        sentiment: 'positive',
        outcome: 'meeting_booked',
        transcript: 'AI: Hello Dr. Miller, this is about dental practice management...'
      }
    ];

    return { success: true, data: mockCalls };
  },

  async getMeetings(): Promise<ApiResponse<Meeting[]>> {
    await delay(500);
    
    const mockMeetings: Meeting[] = [
      {
        id: '1',
        prospectId: '1',
        scheduledAt: new Date(Date.now() + 2 * 86400000),
        duration: 30,
        type: 'demo',
        status: 'scheduled'
      }
    ];

    return { success: true, data: mockMeetings };
  }
};