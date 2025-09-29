// Configuration for n8n webhooks and Millis AI
const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://prajan17.app.n8n.cloud';
const MILLIS_API_URL = 'https://api-west.millis.ai/start_outbound_call';
const MILLIS_API_KEY = import.meta.env.VITE_MILLIS_API_KEY || 'RYVh3Rbu30RBtTodEXF3HyK65kIZ8c3z';
const MILLIS_AGENT_ID = import.meta.env.VITE_MILLIS_AGENT_ID || '-O_CLSMzKm-njTzW6xtm';
const MILLIS_FROM_PHONE = import.meta.env.VITE_MILLIS_FROM_PHONE || '+17744855611';

// Mock Airtable API for fetching records (replace with actual Airtable API)
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY || 'your_airtable_key';
const AIRTABLE_BASE_ID = 'appeeCIow2wLzOUNT';
const AIRTABLE_TABLE_ID = 'tblnPKEDDif2ZGgLA';

interface OutboundCallRequest {
  doctor_name: string;
  contact_no: string;
  timezone: string;
}

interface CallRecord {
  id: string;
  call_id: string;
  doctor_name: string;
  from_phone: string;
  to_phone: string;
  call_start_time: string;
  call_end_time: string;
  call_duration_seconds: number;
  transcript: string;
  call_sentiment: 'Positive' | 'Neutral' | 'Negative';
  meeting_booked: boolean;
  objection_raised: boolean;
  objection_type?: string;
  conversion_stage: string;
  interest_level: 'High' | 'Medium' | 'Low';
  key_pain_points?: string;
  follow_up_needed: boolean;
  prospect_timezone?: string;
  meeting_details?: any;
}

class OutboundCallsApi {
  async initiateOutboundCall(data: OutboundCallRequest) {
    try {
      // Format phone number
      const formattedPhone = data.contact_no.match(/\+?\d+/)?.[0] || data.contact_no;

      // Call Millis AI API directly
      const response = await fetch(MILLIS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': MILLIS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from_phone: MILLIS_FROM_PHONE,
          to_phone: formattedPhone,
          agent_id: MILLIS_AGENT_ID,
          include_metadata_in_prompt: true,
          metadata: {
            doctor_name: data.doctor_name,
            timezone: data.timezone,
            prospect_timezone: data.timezone
          },
          webhook_url: `${N8N_BASE_URL}/webhook/transcript`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error initiating outbound call:', error);
      throw new Error(error.message || 'Failed to initiate call');
    }
  }

  async getCallRecords(): Promise<CallRecord[]> {
    try {
      // For demo purposes, return mock data
      // In production, this would fetch from Airtable API
      const mockRecords: CallRecord[] = [
        {
          id: '1',
          call_id: 'call_abc123',
          doctor_name: 'Dr. Sarah Johnson',
          from_phone: '+17744855611',
          to_phone: '+1234567890',
          call_start_time: new Date(Date.now() - 3600000).toISOString(),
          call_end_time: new Date(Date.now() - 3300000).toISOString(),
          call_duration_seconds: 300,
          transcript: 'Agent: Hello, this is Sarah from iosys. I\'m calling about our dental practice management software.\nCustomer: Hi Sarah, yes I\'ve been looking for a solution.\nAgent: Great! I\'d love to schedule a demo to show you how we can help streamline your practice.\nCustomer: That sounds good. Let\'s book it for next Tuesday.',
          call_sentiment: 'Positive',
          meeting_booked: true,
          objection_raised: false,
          conversion_stage: 'Closed',
          interest_level: 'High',
          key_pain_points: 'Scheduling and billing inefficiencies',
          follow_up_needed: false,
          prospect_timezone: 'Eastern'
        },
        {
          id: '2',
          call_id: 'call_def456',
          doctor_name: 'Dr. Michael Chen',
          from_phone: '+17744855611',
          to_phone: '+1987654321',
          call_start_time: new Date(Date.now() - 7200000).toISOString(),
          call_end_time: new Date(Date.now() - 7020000).toISOString(),
          call_duration_seconds: 180,
          transcript: 'Agent: Hello, this is Sarah from iosys calling about our practice management software.\nCustomer: We\'re actually quite busy right now.\nAgent: I understand. Would there be a better time to discuss how we can help reduce your administrative workload?\nCustomer: Maybe call back next month.',
          call_sentiment: 'Neutral',
          meeting_booked: false,
          objection_raised: true,
          objection_type: 'Timing',
          conversion_stage: 'Considering',
          interest_level: 'Low',
          key_pain_points: 'Time constraints',
          follow_up_needed: true,
          prospect_timezone: 'Central'
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return mockRecords;

      // Actual Airtable implementation would be:
      /*
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.records.map((record: any) => ({
        id: record.id,
        ...record.fields
      }));
      */
    } catch (error) {
      console.error('Error fetching call records:', error);
      throw error;
    }
  }

  async getCallRecord(callId: string): Promise<CallRecord | null> {
    try {
      const records = await this.getCallRecords();
      return records.find(r => r.call_id === callId) || null;
    } catch (error) {
      console.error('Error fetching call record:', error);
      throw error;
    }
  }

  async processTranscriptWebhook(webhookData: any) {
    // This would be handled by the n8n workflow
    // The webhook data flows through n8n for processing and storage
    console.log('Webhook data received:', webhookData);
    return { success: true };
  }

  async getCallAnalytics() {
    try {
      const records = await this.getCallRecords();
      
      const analytics = {
        totalCalls: records.length,
        meetingsBooked: records.filter(r => r.meeting_booked).length,
        avgDuration: records.reduce((acc, r) => acc + r.call_duration_seconds, 0) / records.length || 0,
        sentimentBreakdown: {
          positive: records.filter(r => r.call_sentiment === 'Positive').length,
          neutral: records.filter(r => r.call_sentiment === 'Neutral').length,
          negative: records.filter(r => r.call_sentiment === 'Negative').length,
        },
        interestLevels: {
          high: records.filter(r => r.interest_level === 'High').length,
          medium: records.filter(r => r.interest_level === 'Medium').length,
          low: records.filter(r => r.interest_level === 'Low').length,
        },
        conversionRate: records.length > 0 
          ? (records.filter(r => r.meeting_booked).length / records.length) * 100 
          : 0,
        commonObjections: records
          .filter(r => r.objection_type)
          .reduce((acc: Record<string, number>, r) => {
            const type = r.objection_type!;
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})
      };

      return analytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }
}

export const outboundCallsApi = new OutboundCallsApi();
