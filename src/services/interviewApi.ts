import type {
  Interview,
  InterviewLiveStatus,
  InterviewMetrics,
  InterviewSettings,
  InterviewTemplate,
  LiveKitCredentials,
} from '@/types';

const DEFAULT_BASE_URL = 'http://localhost:8002';

const normalizeBaseUrl = (url: string | undefined | null): string => {
  if (!url) return DEFAULT_BASE_URL;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const INTERVIEW_API_BASE_URL = normalizeBaseUrl(
  import.meta.env?.VITE_INTERVIEW_API_BASE_URL,
);

const buildUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  return `${INTERVIEW_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

interface ApiError {
  detail?: string;
  message?: string;
  error?: string;
}

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as ApiError;
    return (
      data?.detail ||
      data?.message ||
      data?.error ||
      `Interview API request failed with status ${response.status}`
    );
  } catch (error) {
    const fallback = await response.text().catch(() => undefined);
    return fallback?.trim() || `Interview API request failed with status ${response.status}`;
  }
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

const handleBlobResponse = async (response: Response): Promise<Blob> => {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return response.blob();
};

export interface CreateInterviewPayload {
  candidateName: string;
  position: string;
  duration?: number;
  scheduledAt?: string;
  jobDescription?: string;
  resume?: string;
  settings?: Partial<InterviewSettings>;
  metadata?: Record<string, unknown>;
}

const filterUndefined = <T extends Record<string, unknown>>(payload: T): T => {
  return Object.entries(payload).reduce<Partial<T>>((accumulator, [key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        accumulator[key as keyof T] = value.filter((item) => item !== undefined && item !== null) as T[keyof T];
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        accumulator[key as keyof T] = filterUndefined(value as Record<string, unknown>) as T[keyof T];
      } else {
        accumulator[key as keyof T] = value as T[keyof T];
      }
    }
    return accumulator;
  }, {}) as T;
};

const DEFAULT_SETTINGS: InterviewSettings = {
  duration: 60,
  durationUnit: 'minutes',
  topics: ['Python', 'System Design'],
  difficulty: 'mid',
  includeVideo: true,
  includeAudio: true,
  autoEvaluation: true,
  language: 'en',
};

const DEFAULT_CREATE_PAYLOAD: CreateInterviewPayload = {
  candidateName: '',
  position: '',
  scheduledAt: new Date().toISOString(),
  duration: 60,
  jobDescription: '',
  resume: '',
  settings: DEFAULT_SETTINGS,
  metadata: {},
};

const createDefaultInterviewPayload = (): CreateInterviewPayload => ({
  ...DEFAULT_CREATE_PAYLOAD,
  scheduledAt: new Date().toISOString(),
  settings: { ...DEFAULT_SETTINGS },
  metadata: {},
});

const listInterviews = async (): Promise<Interview[]> => {
  const response = await fetch(buildUrl('/interviews'), {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse<Interview[]>(response);
};

const getInterview = async (interviewId: string): Promise<Interview> => {
  const response = await fetch(buildUrl(`/interviews/${encodeURIComponent(interviewId)}`), {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse<Interview>(response);
};

const createInterview = async (payload: CreateInterviewPayload): Promise<Interview> => {
  const response = await fetch(buildUrl('/interviews'), {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(filterUndefined(payload)),
  });
  return handleResponse<Interview>(response);
};

const startInterview = async (interviewId: string): Promise<LiveKitCredentials> => {
  const response = await fetch(buildUrl(`/interviews/${encodeURIComponent(interviewId)}/start`), {
    method: 'POST',
    headers: defaultHeaders,
  });
  return handleResponse<LiveKitCredentials>(response);
};

const stopInterview = async (interviewId: string): Promise<void> => {
  const response = await fetch(buildUrl(`/interviews/${encodeURIComponent(interviewId)}/stop`), {
    method: 'POST',
    headers: defaultHeaders,
  });
  await handleResponse<undefined>(response);
};

const getLiveStatus = async (interviewId: string): Promise<InterviewLiveStatus> => {
  const response = await fetch(buildUrl(`/interviews/${encodeURIComponent(interviewId)}/status`), {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse<InterviewLiveStatus>(response);
};

const getMetrics = async (): Promise<InterviewMetrics> => {
  const response = await fetch(buildUrl('/interviews/metrics'), {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse<InterviewMetrics>(response);
};

const listTemplates = async (): Promise<InterviewTemplate[]> => {
  const response = await fetch(buildUrl('/templates'), {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse<InterviewTemplate[]>(response);
};

const downloadTranscript = async (interviewId: string): Promise<Blob> => {
  const response = await fetch(buildUrl(`/interviews/${encodeURIComponent(interviewId)}/transcript`), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  return handleBlobResponse(response);
};

export const interviewApi = {
  listInterviews,
  getInterview,
  createInterview,
  startInterview,
  stopInterview,
  getLiveStatus,
  getMetrics,
  listTemplates,
  downloadTranscript,
  createDefaultInterviewPayload,
};

export type { CreateInterviewPayload };

