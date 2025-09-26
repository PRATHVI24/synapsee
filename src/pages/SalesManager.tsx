import { useState, useEffect } from "react";
import { Phone, TrendingUp, Users, Calendar, BarChart3, Play, Pause, Upload, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { salesApi } from "@/services/api";
import { Campaign, Call, Meeting, Prospect } from "@/types";

const SalesManager = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsResponse, meetingsResponse] = await Promise.all([
        salesApi.getCampaigns(),
        salesApi.getMeetings()
      ]);

      if (campaignsResponse.success) {
        setCampaigns(campaignsResponse.data);
        if (campaignsResponse.data.length > 0) {
          setActiveCampaign(campaignsResponse.data[0]);
          const callsResponse = await salesApi.getCalls(campaignsResponse.data[0].id);
          if (callsResponse.success) {
            setCalls(callsResponse.data);
          }
        }
      }

      if (meetingsResponse.success) {
        setMeetings(meetingsResponse.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load campaign data",
        variant: "destructive",
      });
    }
  };

  const startCampaign = (campaign: Campaign) => {
    setIsCallActive(true);
    toast({
      title: "Campaign Started",
      description: `${campaign.name} is now active`,
    });
  };

  const stopCampaign = () => {
    setIsCallActive(false);
    toast({
      title: "Campaign Paused",
      description: "All active calls have been stopped",
    });
  };

  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
  };

  const getProspectStatusColor = (status: Prospect['status']) => {
    const colors = {
      new: 'outline',
      contacted: 'secondary',
      interested: 'default',
      considering: 'outline',
      closed: 'default'
    } as const;
    return colors[status];
  };

  const getCallOutcomeColor = (outcome: Call['outcome']) => {
    const colors = {
      interested: 'default',
      not_interested: 'destructive',
      callback: 'secondary',
      meeting_booked: 'default'
    } as const;
    return outcome ? colors[outcome] : 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-sales flex items-center justify-center">
              <Phone className="h-5 w-5 text-white" />
            </div>
            AI Outbound Sales Manager
          </h1>
          <p className="text-muted-foreground mt-2">
            Dental Practice Lead Generation System with AI-powered outbound calling
          </p>
        </div>
      </div>

      {/* Active Campaign Status */}
      {activeCampaign && (
        <Card className="dashboard-card project-sales border-sales">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  {activeCampaign.name}
                </CardTitle>
                <CardDescription>
                  {activeCampaign.prospects.length} prospects • {activeCampaign.analytics.totalCalls} total calls
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                {isCallActive && <div className="w-3 h-3 rounded-full bg-success animate-pulse" />}
                <Badge variant={isCallActive ? "default" : "outline"}>
                  {isCallActive ? "ACTIVE" : activeCampaign.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-sales-light rounded-lg">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="font-medium text-lg">{Math.round(activeCampaign.analytics.successRate * 100)}%</p>
              </div>
              <div className="p-3 bg-sales-light rounded-lg">
                <p className="text-sm text-muted-foreground">Meetings Booked</p>
                <p className="font-medium text-lg">{activeCampaign.analytics.meetingsBooked}</p>
              </div>
              <div className="p-3 bg-sales-light rounded-lg">
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="font-medium text-lg">{Math.round(activeCampaign.analytics.conversionRate * 100)}%</p>
              </div>
              <div className="p-3 bg-sales-light rounded-lg">
                <p className="text-sm text-muted-foreground">Avg. Duration</p>
                <p className="font-medium text-lg">{Math.round(activeCampaign.analytics.averageDuration)}s</p>
              </div>
            </div>

            <div className="flex gap-2">
              {isCallActive ? (
                <Button onClick={stopCampaign} variant="destructive">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Campaign
                </Button>
              ) : (
                <Button onClick={() => startCampaign(activeCampaign)}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Campaign
                </Button>
              )}
              
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Prospects
              </Button>
              
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Campaign Dashboard</TabsTrigger>
          <TabsTrigger value="prospects">Prospect Management</TabsTrigger>
          <TabsTrigger value="analytics">Call Analytics</TabsTrigger>
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="pipeline">Lead Pipeline</TabsTrigger>
          <TabsTrigger value="meetings">Meeting Management</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-sales">
                  {campaigns.reduce((sum, c) => sum + c.analytics.totalCalls, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Across all campaigns</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-sales">24.3%</p>
                <p className="text-sm text-success">+2.1% vs last week</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Meetings Booked
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-sales">{meetings.length}</p>
                <p className="text-sm text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Prospects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-sales">
                  {campaigns.reduce((sum, c) => sum + c.prospects.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">In pipeline</p>
              </CardContent>
            </Card>
          </div>

          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sales-light flex items-center justify-center">
                        <Phone className="h-5 w-5 text-sales" />
                      </div>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.analytics.totalCalls} calls • {campaign.analytics.meetingsBooked} meetings
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{Math.round(campaign.analytics.successRate * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Success Rate</p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'outline'}>
                        {campaign.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setActiveCampaign(campaign)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prospects" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Prospect Management
                  </CardTitle>
                  <CardDescription>
                    Manage your prospect lists from Google Sheets integration
                  </CardDescription>
                </div>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from Google Sheets
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCampaign?.prospects.map((prospect) => (
                  <div key={prospect.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sales-light flex items-center justify-center">
                        <Users className="h-5 w-5 text-sales" />
                      </div>
                      <div>
                        <p className="font-medium">{prospect.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {prospect.company} • {formatPhoneNumber(prospect.phone)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {prospect.lastContact && `Last contact: ${new Date(prospect.lastContact).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={getProspectStatusColor(prospect.status)}>
                        {prospect.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4 mr-2" />
                        Call Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Call Volume by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32 flex items-end justify-between gap-2">
                  {[8, 12, 18, 25, 30, 22, 15].map((height, i) => (
                    <div key={i} className="flex-1 bg-sales-light rounded-t" style={{ height: `${height * 2}px` }} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>9AM</span>
                  <span>12PM</span>
                  <span>3PM</span>
                  <span>6PM</span>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Top Objections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeCampaign?.analytics.topObjections.map((objection, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <p className="text-sm">{objection}</p>
                      <Badge variant="outline">{Math.floor(Math.random() * 20) + 5}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Recent Call Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {calls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sales-light flex items-center justify-center">
                        <Phone className="h-4 w-4 text-sales" />
                      </div>
                      <div>
                        <p className="font-medium">Call #{call.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')} • 
                          {new Date(call.startTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={getCallOutcomeColor(call.outcome)}>
                        {call.outcome?.replace('_', ' ') || call.status}
                      </Badge>
                      {call.sentiment && (
                        <Badge variant={call.sentiment === 'positive' ? 'default' : 'outline'}>
                          {call.sentiment}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcripts" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                AI-Analyzed Call Transcripts
              </CardTitle>
              <CardDescription>
                View call transcripts with sentiment analysis and key insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {calls.filter(call => call.transcript).map((call) => (
                  <div key={call.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">Call #{call.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(call.startTime).toLocaleDateString()} • 
                          Duration: {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {call.sentiment && (
                          <Badge variant={call.sentiment === 'positive' ? 'default' : call.sentiment === 'negative' ? 'destructive' : 'outline'}>
                            {call.sentiment}
                          </Badge>
                        )}
                        {call.outcome && (
                          <Badge variant={getCallOutcomeColor(call.outcome)}>
                            {call.outcome.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-background p-3 rounded border text-sm">
                      <p>{call.transcript}</p>
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm">
                        Full Transcript
                      </Button>
                      <Button variant="outline" size="sm">
                        Analysis Report
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Lead Pipeline</CardTitle>
              <CardDescription>
                Track leads through the sales funnel: Interested → Considering → Closed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-medium mb-3 text-center">Interested</h3>
                  <div className="space-y-2">
                    {activeCampaign?.prospects.filter(p => p.status === 'interested').map((prospect) => (
                      <div key={prospect.id} className="p-3 bg-background border border-border rounded">
                        <p className="font-medium text-sm">{prospect.name}</p>
                        <p className="text-xs text-muted-foreground">{prospect.company}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-medium mb-3 text-center">Considering</h3>
                  <div className="space-y-2">
                    {activeCampaign?.prospects.filter(p => p.status === 'considering').map((prospect) => (
                      <div key={prospect.id} className="p-3 bg-background border border-border rounded">
                        <p className="font-medium text-sm">{prospect.name}</p>
                        <p className="text-xs text-muted-foreground">{prospect.company}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 border border-border rounded-lg">
                  <h3 className="font-medium mb-3 text-center">Closed</h3>
                  <div className="space-y-2">
                    {activeCampaign?.prospects.filter(p => p.status === 'closed').map((prospect) => (
                      <div key={prospect.id} className="p-3 bg-success/10 border border-success/20 rounded">
                        <p className="font-medium text-sm">{prospect.name}</p>
                        <p className="text-xs text-muted-foreground">{prospect.company}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting Management
              </CardTitle>
              <CardDescription>
                Track booked meetings with timezone handling and outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sales-light flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-sales" />
                      </div>
                      <div>
                        <p className="font-medium">Meeting #{meeting.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {meeting.type} • {meeting.duration} minutes • 
                          {new Date(meeting.scheduledAt).toLocaleDateString()} at {new Date(meeting.scheduledAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={meeting.status === 'scheduled' ? 'outline' : meeting.status === 'completed' ? 'default' : 'destructive'}>
                        {meeting.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesManager;