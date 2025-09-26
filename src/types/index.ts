// TypeScript interfaces for all AI/ML projects

// Common types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface FileUpload {
  id: string;
  filename: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'completed' | 'error';
}

// Project 1: HL7 Medical Document Processor
export interface HL7Document {
  id: string;
  filename: string;
  type: 'hl7' | 'medical_image' | 'document';
  uploadedAt: Date;
  status: ProcessingStatus;
  ocrResults?: OCRResult[];
  hl7Data?: HL7ParsedData;
}

export interface OCRResult {
  engine: 'tesseract' | 'google_vision' | 'amazon_textract';
  confidence: number;
  extractedText: string;
  processedAt: Date;
}

export interface HL7ParsedData {
  messageType: string;
  patientInfo: {
    id: string;
    name: string;
    dob: string;
    gender: string;
  };
  segments: HL7Segment[];
}

export interface HL7Segment {
  type: string;
  fields: Record<string, string>;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

// Project 2: Finance OCR
export interface FinanceDocument {
  id: string;
  filename: string;
  uploadedAt: Date;
  status: ProcessingStatus;
  extractedData?: FinancialData;
  corrections?: Record<string, string>;
}

export interface FinancialData {
  documentType: 'invoice' | 'receipt' | 'bank_statement' | 'tax_document';
  amount: number;
  currency: string;
  date: Date;
  vendor: string;
  items: FinancialItem[];
  confidence: number;
}

export interface FinancialItem {
  description: string;
  amount: number;
  quantity?: number;
  category?: string;
}

// Project 3: AI Interview Bot
export interface InterviewEvaluation {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  feedback: string;
  recommendations: string[];
}

export interface InterviewSettings {
  duration: number;
  durationUnit?: 'minutes' | 'seconds';
  topics: string[];
  difficulty: 'junior' | 'mid' | 'senior';
  includeVideo: boolean;
  includeAudio?: boolean;
  autoEvaluation: boolean;
  language?: string;
  timezone?: string;
  remindersEnabled?: boolean;
}

export type InterviewStatus =
  | 'scheduled'
  | 'preparing'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface InterviewLiveStatus {
  status: InterviewStatus;
  startedAt?: string;
  endedAt?: string;
  progressPercent?: number;
  remainingSeconds?: number;
  currentTopic?: string;
}

export interface InterviewTranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'ai' | 'candidate' | 'system';
  text: string;
}

export interface LiveKitCredentials {
  token: string;
  url: string;
  roomName: string;
  participantIdentity: string;
}

export interface Interview {
  id: string;
  candidateName: string;
  position: string;
  scheduledAt: string;
  duration: number; // minutes
  status: InterviewStatus;
  jobDescription?: string;
  resume?: string;
  settings?: InterviewSettings;
  liveStatus?: InterviewLiveStatus;
  transcriptEntries?: InterviewTranscriptEntry[];
  evaluation?: InterviewEvaluation;
  createdAt?: string;
  updatedAt?: string;
}

export interface InterviewTemplate {
  id: string;
  name: string;
  role: string;
  description?: string;
  settings: InterviewSettings;
  questions?: string[];
  updatedAt: string;
}

export interface InterviewMetrics {
  totalInterviews: number;
  activeInterviews: number;
  completionRate: number;
  averageScore: number;
  averageDuration: number;
  interviewsByRole: Array<{
    role: string;
    count: number;
    averageScore: number;
  }>;
}

// Project 4: AI Outbound Sales Manager
export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  prospects: Prospect[];
  analytics: CampaignAnalytics;
}

export interface Prospect {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: 'new' | 'contacted' | 'interested' | 'considering' | 'closed';
  lastContact?: Date;
  notes?: string;
}

export interface Call {
  id: string;
  prospectId: string;
  campaignId: string;
  startTime: Date;
  duration: number; // seconds
  status: 'completed' | 'no_answer' | 'busy' | 'failed';
  transcript?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  outcome?: 'interested' | 'not_interested' | 'callback' | 'meeting_booked';
}

export interface CampaignAnalytics {
  totalCalls: number;
  successRate: number;
  averageDuration: number;
  meetingsBooked: number;
  conversionRate: number;
  topObjections: string[];
}

export interface Meeting {
  id: string;
  prospectId: string;
  scheduledAt: Date;
  duration: number;
  type: 'demo' | 'consultation' | 'follow_up';
  status: 'scheduled' | 'completed' | 'cancelled';
  outcome?: string;
}