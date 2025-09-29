import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Calendar, 
  Clock, 
  User, 
  MessageSquare,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  RefreshCw
} from 'lucide-react';
import { outboundCallsApi } from '@/services/outboundCallsApi';
import { format } from 'date-fns';

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

interface NewCallData {
  doctor_name: string;
  contact_no: string;
  timezone: string;
}

export default function OutboundCalls() {
  const [activeTab, setActiveTab] = useState('new-call');
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newCallData, setNewCallData] = useState<NewCallData>({
    doctor_name: '',
    contact_no: '',
    timezone: 'Eastern'
  });
  const [callStatus, setCallStatus] = useState<'idle' | 'initiating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCallRecords();
  }, []);

  const fetchCallRecords = async () => {
    setIsRefreshing(true);
    try {
      const records = await outboundCallsApi.getCallRecords();
      setCallRecords(records);
    } catch (error) {
      console.error('Error fetching call records:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const initiateCall = async () => {
    if (!newCallData.doctor_name || !newCallData.contact_no) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setCallStatus('initiating');
    setErrorMessage('');

    try {
      const response = await outboundCallsApi.initiateOutboundCall(newCallData);
      setCallStatus('success');
      
      // Reset form
      setNewCallData({
        doctor_name: '',
        contact_no: '',
        timezone: 'Eastern'
      });

      // Switch to history tab
      setTimeout(() => {
        setActiveTab('history');
        fetchCallRecords();
      }, 2000);
    } catch (error: any) {
      setCallStatus('error');
      setErrorMessage(error.message || 'Failed to initiate call');
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return 'text-green-600';
      case 'Negative': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getInterestBadgeVariant = (level: string) => {
    switch (level) {
      case 'High': return 'default';
      case 'Medium': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportTranscript = (record: CallRecord) => {
    const content = `
Call Transcript
===============
Doctor: ${record.doctor_name}
Call ID: ${record.call_id}
Date: ${format(new Date(record.call_start_time), 'PPP')}
Duration: ${formatDuration(record.call_duration_seconds)}
Sentiment: ${record.call_sentiment}
Meeting Booked: ${record.meeting_booked ? 'Yes' : 'No'}

Transcript:
-----------
${record.transcript}

Analysis:
---------
Interest Level: ${record.interest_level}
Conversion Stage: ${record.conversion_stage}
${record.key_pain_points ? `Pain Points: ${record.key_pain_points}` : ''}
${record.objection_raised ? `Objection: ${record.objection_type}` : ''}
Follow-up Needed: ${record.follow_up_needed ? 'Yes' : 'No'}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${record.call_id}.txt`;
    a.click();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Outbound Call Management</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered outbound calling system with real-time transcription and analysis
          </p>
        </div>
        <Button 
          onClick={fetchCallRecords}
          variant="outline"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new-call">
            <Phone className="h-4 w-4 mr-2" />
            New Call
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            Call History
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-call" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Initiate Outbound Call</CardTitle>
              <CardDescription>
                Start a new AI-powered sales call with automatic transcription and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctor-name">Doctor/Contact Name *</Label>
                  <Input
                    id="doctor-name"
                    placeholder="Dr. John Smith"
                    value={newCallData.doctor_name}
                    onChange={(e) => setNewCallData({ ...newCallData, doctor_name: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-no">Phone Number *</Label>
                  <Input
                    id="contact-no"
                    placeholder="+1234567890"
                    value={newCallData.contact_no}
                    onChange={(e) => setNewCallData({ ...newCallData, contact_no: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={newCallData.timezone}
                    onValueChange={(value) => setNewCallData({ ...newCallData, timezone: value })}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Eastern">Eastern Time</SelectItem>
                      <SelectItem value="Central">Central Time</SelectItem>
                      <SelectItem value="Mountain">Mountain Time</SelectItem>
                      <SelectItem value="Pacific">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              {callStatus === 'success' && (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Call initiated successfully! The AI agent is now calling the prospect.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={initiateCall}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Initiating Call...
                  </>
                ) : (
                  <>
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Start Outbound Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold">1. Initiate Call</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter contact details and our AI agent calls the prospect
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold">2. AI Conversation</h4>
                  <p className="text-sm text-muted-foreground">
                    Natural conversation with real-time transcription
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold">3. Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Get insights, sentiment analysis, and follow-up actions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>
                View and analyze your outbound call history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {callRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No call records found. Start making calls to see them here.
                </div>
              ) : (
                <div className="space-y-4">
                  {callRecords.map((record) => (
                    <Card 
                      key={record.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{record.doctor_name}</span>
                              <Badge variant={getInterestBadgeVariant(record.interest_level)}>
                                {record.interest_level} Interest
                              </Badge>
                              {record.meeting_booked && (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Meeting Booked
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {record.to_phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(record.call_duration_seconds)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(record.call_start_time), 'PPp')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${getSentimentColor(record.call_sentiment)}`}>
                                {record.call_sentiment} Sentiment
                              </span>
                              {record.objection_raised && (
                                <Badge variant="outline" className="text-orange-600">
                                  Objection: {record.objection_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportTranscript(record);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Call Details - {selectedRecord.doctor_name}</CardTitle>
                <CardDescription>
                  Call ID: {selectedRecord.call_id}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold">{formatDuration(selectedRecord.call_duration_seconds)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sentiment</p>
                    <p className={`font-semibold ${getSentimentColor(selectedRecord.call_sentiment)}`}>
                      {selectedRecord.call_sentiment}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interest Level</p>
                    <p className="font-semibold">{selectedRecord.interest_level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stage</p>
                    <p className="font-semibold">{selectedRecord.conversion_stage}</p>
                  </div>
                </div>

                {selectedRecord.key_pain_points && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Key Pain Points</p>
                    <p className="text-sm">{selectedRecord.key_pain_points}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Transcript</p>
                  <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{selectedRecord.transcript}</pre>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedRecord(null)}>
                    Close
                  </Button>
                  <Button onClick={() => exportTranscript(selectedRecord)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Transcript
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{callRecords.length}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {callRecords.filter(r => r.meeting_booked).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {callRecords.length > 0 
                    ? `${((callRecords.filter(r => r.meeting_booked).length / callRecords.length) * 100).toFixed(1)}% conversion`
                    : '0% conversion'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {callRecords.length > 0 
                    ? formatDuration(Math.round(callRecords.reduce((acc, r) => acc + r.call_duration_seconds, 0) / callRecords.length))
                    : '0:00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Per call</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sentiment Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Positive', 'Neutral', 'Negative'].map(sentiment => {
                  const count = callRecords.filter(r => r.call_sentiment === sentiment).length;
                  const percentage = callRecords.length > 0 ? (count / callRecords.length) * 100 : 0;
                  return (
                    <div key={sentiment} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={getSentimentColor(sentiment)}>{sentiment}</span>
                        <span className="text-muted-foreground">{count} calls ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            sentiment === 'Positive' ? 'bg-green-500' :
                            sentiment === 'Negative' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common Objections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(new Set(callRecords.filter(r => r.objection_type).map(r => r.objection_type)))
                  .map(objection => {
                    const count = callRecords.filter(r => r.objection_type === objection).length;
                    return (
                      <div key={objection} className="flex justify-between items-center">
                        <span className="text-sm">{objection}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    );
                  })}
                {callRecords.filter(r => r.objection_type).length === 0 && (
                  <p className="text-sm text-muted-foreground">No objections recorded yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
