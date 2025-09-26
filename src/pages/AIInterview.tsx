import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionState,
  LocalAudioTrack,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from "livekit-client";
import {
  Bot,
  Upload,
  Play,
  Pause,
  Video,
  Mic,
  Calendar,
  BarChart3,
  Settings,
  Users,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Rocket,
  FileText,
  ClipboardCheck,
  LineChart,
  SlidersHorizontal,
  Signal,
  Waves,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { interviewApi } from "@/services/interviewApi";
import type {
  Interview,
  InterviewLiveStatus,
  InterviewSettings,
  InterviewTemplate,
  InterviewTranscriptEntry,
  InterviewMetrics,
  LiveKitCredentials,
} from "@/types";

const AIInterview = () => {
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [activeInterview, setActiveInterview] = useState<Interview | null>(null);
  const [liveStatus, setLiveStatus] = useState<InterviewLiveStatus | null>(null);
  const [transcript, setTranscript] = useState<InterviewTranscriptEntry[]>([]);
  const [metrics, setMetrics] = useState<InterviewMetrics | null>(null);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioTracksRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const participantsRef = useRef<Map<string, Participant>>(new Map());
  const eventListenersRef = useRef<(() => void)[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [newInterview, setNewInterview] = useState(() =>
    interviewApi.createDefaultInterviewPayload(),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const [manualProgress, setManualProgress] = useState<number>(0);

  const baseMetrics = useMemo(
    () => ({ totalInterviews: 0, completionRate: 0, averageScore: 0, averageDuration: 0 }),
    [],
  );

  // Utility helpers
  const appendLog = useCallback((message: string) => {
    setLiveLogs((prev) => {
      const timestamp = new Date().toLocaleTimeString();
      const entry = `[${timestamp}] ${message}`;
      const updated = [entry, ...prev];
      return updated.slice(0, 100); // keep latest 100 entries
    });
  }, []);

  const resetLiveState = useCallback(() => {
    setLiveStatus(null);
    setTranscript([]);
    setParticipants([]);
    setManualProgress(0);
    setConnectionError(null);
    setLiveLogs([]);
  }, []);

  const cleanupRoom = useCallback(async () => {
    if (heartbeatIntervalRef.current !== null) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    eventListenersRef.current.forEach((unsubscribe) => unsubscribe());
    eventListenersRef.current = [];

    audioTracksRef.current.forEach((audioEl) => {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
    });
    audioTracksRef.current.clear();

    const room = roomRef.current;
    roomRef.current = null;
    participantsRef.current.clear();

    if (micTrackRef.current) {
      try {
        micTrackRef.current.stop();
      } catch (error) {
        console.warn("Failed to stop microphone track", error);
      }
      micTrackRef.current = null;
    }

    if (room) {
      appendLog("Disconnecting from LiveKit room");
      try {
        await room.disconnect();
    } catch (error) {
        console.error("Error disconnecting from room", error);
      }
    }

    setConnectionState(ConnectionState.Disconnected);
  }, [appendLog]);

  useEffect(() => {
    return () => {
      cleanupRoom();
    };
  }, [cleanupRoom]);

  const loadInitialData = useCallback(async () => {
    setLoadingInterviews(true);
    try {
      const [interviewList, fetchedMetrics, fetchedTemplates] = await Promise.all([
        interviewApi.listInterviews(),
        interviewApi.getMetrics().catch(() => null),
        interviewApi.listTemplates().catch(() => []),
      ]);

      setInterviews(interviewList);
      setMetrics(fetchedMetrics || baseMetrics);
      setTemplates(fetchedTemplates);

      appendLog(`Loaded ${interviewList.length} interviews from backend`);
    } catch (error) {
      console.error("Failed to load interview data", error);
      toast({
        title: "Unable to load interviews",
        description:
          error instanceof Error ? error.message : "Please verify the AI Interview backend",
        variant: "destructive",
      });
    } finally {
      setLoadingInterviews(false);
    }
  }, [appendLog, baseMetrics, toast]);

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      loadInitialData();
    }, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [loadInitialData]);

  const refreshInterviewDetails = useCallback(
    async (interviewId: string, shouldSelect = false) => {
      try {
        const details = await interviewApi.getInterview(interviewId);
        setInterviews((prev) =>
          prev.map((item) => (item.id === details.id ? { ...item, ...details } : item)),
        );
        if (shouldSelect) {
          setActiveInterview(details);
        }
      } catch (error) {
        console.error("Failed to refresh interview details", error);
      }
    },
    [],
  );

  const handleCreateInterview = useCallback(async () => {
    if (!newInterview.candidateName || !newInterview.position) {
      toast({
        title: "Missing details",
        description: "Candidate name and position are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const created = await interviewApi.createInterview(newInterview);
      setInterviews((prev) => [created, ...prev]);
      setNewInterview(interviewApi.createDefaultInterviewPayload());
      setSelectedTemplateId(null);
      toast({ title: "Interview scheduled", description: created.candidateName });
      appendLog(`Interview created for ${created.candidateName}`);
    } catch (error) {
      console.error("Failed to create interview", error);
      toast({
        title: "Creation failed",
        description:
          error instanceof Error
            ? error.message
            : "Ensure the Interview Bot backend is running on port 8002",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [appendLog, newInterview, toast]);

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId);
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;

      setNewInterview((prev) => ({
        ...prev,
        position: template.role,
        settings: template.settings,
        jobDescription: template.description || prev.jobDescription,
      }));

      appendLog(`Applied template ${template.name}`);
    },
    [appendLog, templates],
  );

  const getStatusBadge = useCallback((status: string) => {
    const statusLabel = status.replace(/_/g, " ");
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      scheduled: "outline",
      preparing: "outline",
      in_progress: "secondary",
      completed: "default",
      cancelled: "destructive",
      failed: "destructive",
    };

    return <Badge variant={variants[status] ?? "outline"}>{statusLabel}</Badge>;
  }, []);

  const attachTrack = useCallback((participant: Participant, track: Track) => {
    if (track.kind !== Track.Kind.Audio) return;

    const audioEl = track.attach();
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.dataset.participant = participant.identity;
    document.body.appendChild(audioEl);
    audioTracksRef.current.set(track.sid, audioEl);
    appendLog(`Audio track attached for ${participant.identity}`);
  }, [appendLog]);

  const detachTrack = useCallback((track: Track) => {
    const audioEl = audioTracksRef.current.get(track.sid);
    if (audioEl) {
      track.detach(audioEl);
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioTracksRef.current.delete(track.sid);
    }
  }, []);

  const updateParticipantList = useCallback(() => {
    const participantsArray = Array.from(participantsRef.current.values());
    setParticipants(participantsArray);
  }, []);

  const handleParticipantConnected = useCallback(
    (participant: RemoteParticipant) => {
      participantsRef.current.set(participant.sid, participant);
      appendLog(`Participant connected: ${participant.identity}`);
      updateParticipantList();
    },
    [appendLog, updateParticipantList],
  );

  const handleParticipantDisconnected = useCallback(
    (participant: RemoteParticipant) => {
      participantsRef.current.delete(participant.sid);
      appendLog(`Participant disconnected: ${participant.identity}`);
      updateParticipantList();
    },
    [appendLog, updateParticipantList],
  );

  const handleLiveStatusUpdate = useCallback((status: InterviewLiveStatus) => {
    setLiveStatus(status);
    if (status.progressPercent !== undefined) {
      setManualProgress(status.progressPercent);
    }
    if (status.remainingSeconds !== undefined) {
      setLastHeartbeat(Date.now());
    }
  }, []);

  const handleTranscriptChunk = useCallback((entry: InterviewTranscriptEntry) => {
    setTranscript((prev) => {
      const exists = prev.find((item) => item.id === entry.id);
      if (exists) return prev;
      return [...prev, entry].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    });
  }, []);

  const connectToLiveKit = useCallback(
    async (credentials: LiveKitCredentials) => {
      await cleanupRoom();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoSimulcastLayers: [],
          dtx: true,
        },
      });

      roomRef.current = room;

      const unsubscribe = (event: RoomEvent, handler: (...args: any[]) => void) => {
        room.on(event, handler);
        return () => room.off(event, handler);
      };

      eventListenersRef.current.push(
        unsubscribe(RoomEvent.ParticipantConnected, handleParticipantConnected),
        unsubscribe(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected),
        unsubscribe(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          appendLog(`Track subscribed: ${track.kind} from ${participant.identity}`);
          if (track.kind === Track.Kind.Audio) {
            attachTrack(participant, track);
            // Force audio playback
            setTimeout(() => {
              const audioEl = audioTracksRef.current.get(track.sid);
              if (audioEl) {
                audioEl.volume = 1.0;
                audioEl.muted = false;
                audioEl.play().then(() => {
                  appendLog(`Audio playback started for ${participant.identity}`);
                }).catch(err => {
                  appendLog(`Audio playback error: ${err.message}`);
                  console.error("Audio playback error:", err);
                });
              }
            }, 100);
          }
        }),
        unsubscribe(RoomEvent.TrackUnsubscribed, (track) => {
          appendLog(`Track unsubscribed: ${track.kind}`);
          if (track.kind === Track.Kind.Audio) {
            detachTrack(track);
          }
        }),
        unsubscribe(RoomEvent.DataReceived, (payload) => {
          try {
            const text = new TextDecoder().decode(payload);
            const message = JSON.parse(text);
            if (message.type === "status") {
              handleLiveStatusUpdate(message.payload);
            }
            if (message.type === "transcript") {
              handleTranscriptChunk(message.payload);
            }
            if (message.type === "log") {
              appendLog(message.payload as string);
      }
    } catch (error) {
            console.warn("Unable to parse LiveKit data message", error);
          }
        }),
        unsubscribe(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(state);
          appendLog(`LiveKit connection state: ${state}`);
          if (state === ConnectionState.Disconnected) {
            resetLiveState();
          }
        }),
      );

      try {
        appendLog("Connecting to LiveKit room...");
        await room.connect(credentials.url, credentials.token);
        participantsRef.current.set(room.localParticipant.sid, room.localParticipant);
        updateParticipantList();

        if (isMicEnabled) {
          const audioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
          });
          await room.localParticipant.publishTrack(audioTrack);
          appendLog("Microphone track published");
        }

        setConnectionError(null);

        if (!room.localParticipant?.identity) {
          appendLog("Warning: local participant identity missing");
        }

        heartbeatIntervalRef.current = window.setInterval(() => {
          setLastHeartbeat((prev) => {
            if (!prev) return null;
            const elapsed = Date.now() - prev;
            if (elapsed > 30_000) {
              appendLog("No heartbeat from backend for 30s");
      toast({
                title: "Live interview heartbeat lost",
                description: "Attempting to recover connection",
        variant: "destructive",
      });
    }
            return prev;
          });
        }, 15_000);

        appendLog("Successfully connected to LiveKit");
      } catch (error) {
        console.error("LiveKit connection error", error);
        setConnectionError(
          error instanceof Error ? error.message : "Unable to connect to LiveKit room",
        );
        appendLog("Failed to connect to LiveKit");
        throw error;
      }
    },
    [appendLog, attachTrack, cleanupRoom, detachTrack, handleLiveStatusUpdate, handleParticipantConnected, handleParticipantDisconnected, handleTranscriptChunk, isMicEnabled, resetLiveState, toast, updateParticipantList],
  );

  const handleStartInterview = useCallback(
    async (interviewId: string) => {
      setIsStarting(true);
      setConnectionError(null);
      try {
        const credentials = await interviewApi.startInterview(interviewId);
        const selected = interviews.find((item) => item.id === interviewId) || null;
        if (selected) {
          setActiveInterview(selected);
          setTranscript(selected.transcriptEntries ?? []);
        }
        appendLog(`Starting interview ${interviewId}`);
        await connectToLiveKit(credentials);
        await refreshInterviewDetails(interviewId, true);
        toast({ title: "Interview started", description: "Connecting to LiveKit" });
      } catch (error) {
        console.error("Failed to start interview", error);
        setConnectionError(
          error instanceof Error
            ? error.message
            : "Unable to start LiveKit interview. Verify backend on port 8002.",
        );
        toast({
          title: "Unable to start interview",
          description: connectionError ?? "Check LiveKit token endpoint",
          variant: "destructive",
        });
      } finally {
        setIsStarting(false);
      }
    },
    [appendLog, connectToLiveKit, connectionError, interviews, refreshInterviewDetails, toast],
  );

  const handleStopInterview = useCallback(
    async (interviewId: string) => {
      setIsStopping(true);
      try {
        appendLog(`Stopping interview ${interviewId}`);
        await interviewApi.stopInterview(interviewId);
        await cleanupRoom();
        setActiveInterview(null);
        resetLiveState();
        toast({ title: "Interview stopped" });
        await refreshInterviewDetails(interviewId);
      } catch (error) {
        console.error("Failed to stop interview", error);
    toast({
          title: "Unable to stop interview",
          description: error instanceof Error ? error.message : "Check backend logs",
          variant: "destructive",
        });
      } finally {
        setIsStopping(false);
      }
    },
    [appendLog, cleanupRoom, refreshInterviewDetails, resetLiveState, toast],
  );

  const handleDownloadTranscript = useCallback(async (interviewId: string) => {
    try {
      const blob = await interviewApi.downloadTranscript(interviewId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `interview-${interviewId}-transcript.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Transcript exported" });
    } catch (error) {
      console.error("Failed to download transcript", error);
      toast({
        title: "Unable to export transcript",
        description: error instanceof Error ? error.message : "Check backend endpoint",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleRefresh = useCallback(async () => {
    await loadInitialData();
    if (activeInterview) {
      await refreshInterviewDetails(activeInterview.id, true);
    }
  }, [activeInterview, loadInitialData, refreshInterviewDetails]);

  const filteredTranscript = useMemo(() => {
    return transcript.filter((entry) => entry.text?.trim());
  }, [transcript]);

  useEffect(() => {
    if (!activeInterview) return;

    const interval = setInterval(async () => {
      try {
        const status = await interviewApi.getLiveStatus(activeInterview.id);
        handleLiveStatusUpdate(status);
      } catch (error) {
        console.warn("Failed to poll live status", error);
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [activeInterview, handleLiveStatusUpdate]);

  const renderLiveStatusBadge = useMemo(() => {
    const status = liveStatus?.status || activeInterview?.status;
    if (!status) {
      return <Badge variant="outline">Not connected</Badge>;
    }
    return getStatusBadge(status);
  }, [activeInterview, getStatusBadge, liveStatus]);

  const interviewStats = useMemo(() => {
    const total = metrics?.totalInterviews ?? interviews.length;
    const completed = interviews.filter((item) => item.status === "completed").length;
    const active = interviews.filter((item) => item.status === "in_progress").length;
    return { total, completed, active };
  }, [interviews, metrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-ai flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            AI Interview Bot
          </h1>
          <p className="text-muted-foreground mt-2">
            LiveKit-powered autonomous interviews with real-time analytics and evaluation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loadingInterviews}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsConfigDrawerOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configuration Guide
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
              <div>
              <p className="text-3xl font-bold text-ai">{interviewStats.total}</p>
              <p className="text-xs text-muted-foreground">Across all time</p>
              </div>
            <div className="w-10 h-10 rounded-full bg-ai-light flex items-center justify-center">
              <Calendar className="h-5 w-5 text-ai" />
              </div>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-warning">{interviewStats.active}</p>
              <p className="text-xs text-muted-foreground">Currently running</p>
              </div>
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Signal className="h-5 w-5 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-success">{interviewStats.completed}</p>
              <p className="text-xs text-muted-foreground">Successfully finished interviews</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-ai">
                {metrics?.averageScore ? Math.round(metrics.averageScore) : "--"}
              </p>
              <p className="text-xs text-muted-foreground">Across evaluations</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-ai-light flex items-center justify-center">
              <LineChart className="h-5 w-5 text-ai" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="setup">Interview Setup</TabsTrigger>
          <TabsTrigger value="live">Live Session</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
          <TabsTrigger value="results">Results & Analytics</TabsTrigger>
          <TabsTrigger value="admin">Admin Panel</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="dashboard-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                  Schedule New Interview
              </CardTitle>
              <CardDescription>
                  Configure candidate details, duration, and interview preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="candidateName">Candidate Name *</Label>
                  <Input
                    id="candidateName"
                    value={newInterview.candidateName}
                      onChange={(event) =>
                        setNewInterview((prev) => ({ ...prev, candidateName: event.target.value }))
                      }
                      placeholder="e.g., Priya Sharma"
                      disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={newInterview.position}
                      onChange={(event) =>
                        setNewInterview((prev) => ({ ...prev, position: event.target.value }))
                      }
                      placeholder="e.g., Senior ML Engineer"
                      disabled={isLoading}
                  />
                </div>
                  <div>
                    <Label htmlFor="scheduledAt">Interview Date</Label>
                    <Input
                      id="scheduledAt"
                      type="datetime-local"
                      value={newInterview.scheduledAt?.slice(0, 16) ?? ""}
                      onChange={(event) =>
                        setNewInterview((prev) => ({
                          ...prev,
                          scheduledAt: new Date(event.target.value).toISOString(),
                        }))
                      }
                      disabled={isLoading}
                    />
                  </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select 
                    value={newInterview.duration.toString()} 
                      onValueChange={(value) =>
                        setNewInterview((prev) => ({ ...prev, duration: Number(value) }))
                      }
                  >
                    <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                        {[30, 45, 60, 90].map((value) => (
                          <SelectItem key={value} value={value.toString()}>
                            {value} minutes
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jobDescription">Job Description</Label>
                <Textarea
                  id="jobDescription"
                      value={newInterview.jobDescription ?? ""}
                      onChange={(event) =>
                        setNewInterview((prev) => ({ ...prev, jobDescription: event.target.value }))
                      }
                      placeholder="Optional: override the default JD from backend"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="resume">Candidate Resume</Label>
                <Textarea
                  id="resume"
                      value={newInterview.resume ?? ""}
                      onChange={(event) =>
                        setNewInterview((prev) => ({ ...prev, resume: event.target.value }))
                      }
                      placeholder="Optional: provide candidate resume text"
                  rows={4}
                />
                  </div>
              </div>

                <div className="rounded-md border border-dashed border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" /> Advanced Settings
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Configure interview length, difficulty, video/audio capture, and evaluation.
                      </p>
                    </div>
                    <Switch
                      checked={!!newInterview.settings?.autoEvaluation}
                      onCheckedChange={(checked) =>
                        setNewInterview((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            autoEvaluation: checked,
                          } as InterviewSettings,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>Difficulty Level</Label>
                      <Select
                        value={newInterview.settings?.difficulty ?? "mid"}
                        onValueChange={(value) =>
                          setNewInterview((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              difficulty: value as InterviewSettings["difficulty"],
                            } as InterviewSettings,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior">Junior</SelectItem>
                          <SelectItem value="mid">Mid</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Topics</Label>
                      <Input
                        value={newInterview.settings?.topics?.join(", ") ?? ""}
                        placeholder="Comma separated topics"
                        onChange={(event) =>
                          setNewInterview((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              topics: event.target.value
                                .split(",")
                                .map((topic) => topic.trim())
                                .filter(Boolean),
                            } as InterviewSettings,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">Include Video</p>
                        <p className="text-xs text-muted-foreground">
                          Enable LiveKit video stream during interview
                        </p>
                      </div>
                      <Switch
                        checked={newInterview.settings?.includeVideo ?? true}
                        onCheckedChange={(checked) =>
                          setNewInterview((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              includeVideo: checked,
                            } as InterviewSettings,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">Include Audio</p>
                        <p className="text-xs text-muted-foreground">
                          Capture candidate audio during the session
                        </p>
                      </div>
                      <Switch
                        checked={isAudioEnabled}
                        onCheckedChange={(checked) => setIsAudioEnabled(checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Rocket className="h-4 w-4" />
                  Maximum dynamic duration is determined by backend configuration.
                </div>
              <div className="flex gap-2">
                  <Button variant="outline" disabled>
                    <Upload className="h-4 w-4 mr-2" /> Upload Resume File
                </Button>
                  <Button onClick={handleCreateInterview} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Schedule Interview
                </Button>
              </div>
              </CardFooter>
          </Card>

            <div className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Templates
              </CardTitle>
                  <CardDescription>Reuse standard interview flows.</CardDescription>
            </CardHeader>
                <CardContent className="space-y-3">
                  {templates.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No templates available. Configure in admin panel or rely on defaults.
                    </p>
                  )}
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`w-full rounded-lg border p-3 text-left transition hover:border-ai ${
                        selectedTemplateId === template.id ? "border-ai bg-ai-light" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.role}</p>
                </div>
                        <Badge variant="outline">{template.settings.duration} min</Badge>
                    </div>
                      {template.description ? (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" /> Backend Checklist
                  </CardTitle>
                  <CardDescription>Quick verification steps.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>1. AI Interview backend running on port 8002</p>
                  <p>2. LiveKit server credentials configured in backend</p>
                  <p>3. system_prompt.txt present alongside backend</p>
                  <p>4. Frontend `.env` contains `VITE_INTERVIEW_API_URL`</p>
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card className="dashboard-card border border-ai/40">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
              <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" /> Live Interview Interface
              </CardTitle>
              <CardDescription>
                    Real-time LiveKit session with audio controls, participant list, and transcript feed.
              </CardDescription>
                </div>
                    <div className="flex items-center gap-3">
                  {renderLiveStatusBadge}
                  <span className="text-xs text-muted-foreground">
                    Connection: {connectionState ?? "unknown"}
                  </span>
                      </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 space-y-4">
                  <div className="aspect-video rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                    <div className="text-center space-y-2">
                      <Video className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                        {connectionState === ConnectionState.Connected
                          ? "Video stream active"
                          : "Connect to begin streaming via LiveKit"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Video rendering is managed by LiveKit components in the backend agent.
                        </p>
                      </div>
                    </div>
                    
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Progress</p>
                      <p className="text-lg font-semibold">
                        {Math.round(liveStatus?.progressPercent ?? manualProgress)}%
                      </p>
                      <Progress value={liveStatus?.progressPercent ?? manualProgress} className="h-2" />
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Remaining Time</p>
                      <p className="text-lg font-semibold">
                        {liveStatus?.remainingSeconds
                          ? Math.max(0, Math.round(liveStatus.remainingSeconds / 60)) + " min"
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Current Topic</p>
                      <p className="text-lg font-semibold">
                        {liveStatus?.currentTopic ?? "TBD"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Participants</p>
                      <p className="text-lg font-semibold">{participants.length}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button 
                        disabled={!activeInterview || isStarting || connectionState === ConnectionState.Connected}
                        onClick={() => activeInterview && handleStartInterview(activeInterview.id)}
                        >
                        {isStarting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                      )}
                        Start Session
                        </Button>
                      <Button
                        variant="destructive"
                        disabled={!activeInterview || isStopping || connectionState !== ConnectionState.Connected}
                        onClick={() => activeInterview && handleStopInterview(activeInterview.id)}
                      >
                        {isStopping ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Pause className="h-4 w-4 mr-2" />
                        )}
                        Stop Session
                      </Button>
                      <Button
                        variant={isMicEnabled ? "outline" : "destructive"}
                        onClick={() => setIsMicEnabled((prev) => !prev)}
                      >
                        <Mic className="h-4 w-4 mr-2" /> Mic {isMicEnabled ? "On" : "Muted"}
                      </Button>
                      <Button variant="outline" onClick={() => handleRefresh()}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Sync Status
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => activeInterview && handleDownloadTranscript(activeInterview.id)}
                        disabled={!activeInterview}
                      >
                        <Download className="h-4 w-4 mr-2" /> Export Transcript
                      </Button>
                    </div>
                    {connectionError ? (
                      <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {connectionError}
                  </div>
                    ) : null}
              </div>
                </div>

                <div className="space-y-4">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" /> Participants
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No participants connected</p>
                      ) : (
                        participants.map((participant) => (
                          <div key={participant.sid} className="rounded-lg border border-border p-3">
                            <p className="text-sm font-medium">{participant.identity || participant.sid}</p>
                            <p className="text-xs text-muted-foreground">
                              {participant.isLocal ? "You" : "Remote"}
                            </p>
                          </div>
                        ))
                      )}
            </CardContent>
          </Card>

                  <Card className="border border-border">
              <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4" /> Live Transcript
                      </CardTitle>
              </CardHeader>
                    <CardContent className="space-y-3 max-h-72 overflow-y-auto pr-2">
                      {filteredTranscript.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Transcript appears here during interview.</p>
                      ) : (
                        filteredTranscript.map((entry) => (
                          <div key={entry.id} className="rounded-lg bg-muted p-3">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span className="capitalize">{entry.speaker}</span>
                              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="mt-1 text-sm">{entry.text}</p>
                          </div>
                        ))
                      )}
              </CardContent>
            </Card>

                  <Card className="border border-border">
              <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Waves className="h-4 w-4" /> Live Logs
                      </CardTitle>
              </CardHeader>
                    <CardContent className="space-y-2 max-h-48 overflow-y-auto pr-2 text-xs font-mono">
                      {liveLogs.length === 0 ? (
                        <p className="text-muted-foreground">Live status messages will appear here.</p>
                      ) : (
                        liveLogs.map((log, index) => (
                          <p key={`${log}-${index}`} className="text-muted-foreground">
                            {log}
                          </p>
                        ))
                      )}
              </CardContent>
            </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
            <Card className="dashboard-card">
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Interview Management
              </CardTitle>
              <CardDescription>Start, pause, or monitor interviews in real time.</CardDescription>
              </CardHeader>
            <CardContent className="space-y-3">
              {loadingInterviews ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading interviews...
                </div>
              ) : interviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
                  <Bot className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No interviews scheduled yet. Use the setup tab to create one.
                  </p>
                </div>
              ) : (
                interviews.map((interview) => {
                  const isActive = activeInterview?.id === interview.id;
                  const canStart = ["scheduled", "preparing"].includes(interview.status);
                  const canStop = ["in_progress", "preparing"].includes(interview.status) || isActive;
                  return (
                    <Card key={interview.id} className={`border ${isActive ? "border-ai" : "border-border"}`}>
                      <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold">{interview.candidateName}</h4>
                            {getStatusBadge(interview.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {interview.position} • {interview.duration} min •
                            {" "}
                            {new Date(interview.scheduledAt).toLocaleString()}
                          </p>
                          {interview.liveStatus?.currentTopic && (
                            <p className="text-xs text-muted-foreground">
                              Topic: {interview.liveStatus.currentTopic}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "outline"}
                            onClick={() => {
                              setActiveInterview(interview);
                              setTranscript(interview.transcriptEntries ?? []);
                            }}
                          >
                            {isActive ? "Viewing" : "View Live"}
                          </Button>
                          <Button
                            size="sm"
                            disabled={!canStart || isStarting}
                            onClick={() => handleStartInterview(interview.id)}
                          >
                            <Play className="mr-2 h-4 w-4" /> Start
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!canStop || isStopping}
                            onClick={() => handleStopInterview(interview.id)}
                          >
                            <Pause className="mr-2 h-4 w-4" /> Stop
                          </Button>
                        </div>
              </CardContent>
            </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Interview Analytics
              </CardTitle>
              <CardDescription>Track candidate performance and interview summaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-semibold">
                    {metrics?.completionRate ? `${Math.round(metrics.completionRate * 100)}%` : "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Average Duration</p>
                  <p className="text-2xl font-semibold">
                    {metrics?.averageDuration ? `${Math.round(metrics.averageDuration)} min` : "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Active Interviews</p>
                  <p className="text-2xl font-semibold">{interviewStats.active}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Heartbeat</p>
                  <p className="text-2xl font-semibold">
                    {lastHeartbeat
                      ? `${Math.round((Date.now() - lastHeartbeat) / 1000)}s ago`
                      : "--"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold mb-2">Evaluated Candidates</h4>
                <div className="space-y-3">
                  {interviews
                    .filter((item) => item.evaluation)
                    .map((item) => (
                      <div key={item.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                            <p className="text-sm font-medium">{item.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{item.position}</p>
                      </div>
                          <Badge variant="secondary">
                            Score: {item.evaluation?.overallScore ?? "--"}/100
                      </Badge>
                    </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                            <p className="text-xs text-muted-foreground">Technical</p>
                            <Progress
                              value={item.evaluation?.technicalScore ?? 0}
                              className="mt-1 h-2"
                            />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Communication</p>
                            <Progress
                              value={item.evaluation?.communicationScore ?? 0}
                              className="mt-1 h-2"
                            />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Problem Solving</p>
                            <Progress
                              value={item.evaluation?.problemSolvingScore ?? 0}
                              className="mt-1 h-2"
                            />
                        </div>
                      </div>
                        {item.evaluation?.feedback && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Feedback: {item.evaluation.feedback}
                          </p>
                    )}
                  </div>
                ))}
                  {interviews.every((item) => !item.evaluation) && (
                    <p className="text-sm text-muted-foreground">
                      No evaluations available yet. Once interviews conclude, AI evaluation summaries will appear here.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Admin Panel
              </CardTitle>
              <CardDescription>
                Manage reusable interview templates and system settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Templates</CardTitle>
                    <CardDescription>Manage interview templates stored on backend.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No templates found. Use backend API to configure templates (POST /templates).
                      </p>
                    ) : (
                      templates.map((template) => (
                        <div key={template.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between">
              <div>
                              <p className="text-sm font-medium">{template.name}</p>
                              <p className="text-xs text-muted-foreground">{template.role}</p>
                  </div>
                            <Badge variant="outline">{template.settings.duration} min</Badge>
                  </div>
                          {template.description ? (
                            <p className="mt-2 text-xs text-muted-foreground">{template.description}</p>
                          ) : null}
                  </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">System Configuration</CardTitle>
                    <CardDescription>Review LiveKit and evaluation settings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>• LiveKit server URL and API key are managed by the backend (view `.env`).</p>
                    <p>• Interview duration caps and extensions controlled in `InterviewConfig`.</p>
                    <p>• AI evaluation provider is configured server-side.</p>
                    <p>• Use backend endpoints to toggle storage of transcripts or evaluations.</p>
                  </CardContent>
                </Card>
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <Card className="max-w-3xl w-full">
            <CardHeader>
              <CardTitle>Integration Guide</CardTitle>
              <CardDescription>
                Configure the AI Interview Bot backend and LiveKit connection for full functionality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold">Backend Requirements</h4>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>Run FastAPI backend for Interview Bot on port 8002.</li>
                  <li>
                    Ensure endpoints:
                    <code className="mx-1 rounded bg-muted px-1">/interviews</code>,
                    <code className="mx-1 rounded bg-muted px-1">/interviews/{'{id}'}</code>,
                    <code className="mx-1 rounded bg-muted px-1">/interviews/{'{id}'}/start</code>,
                    <code className="mx-1 rounded bg-muted px-1">/interviews/{'{id}'}/stop</code>,
                    <code className="mx-1 rounded bg-muted px-1">/interviews/{'{id}'}/status</code>
                    exist.
                  </li>
                  <li>Provide LiveKit token via `/interviews/{'{id}'}/start` response.</li>
                </ul>
                  </div>
              <div>
                <h4 className="font-semibold">Frontend Configuration</h4>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    Set <code className="mx-1 rounded bg-muted px-1">VITE_INTERVIEW_API_BASE_URL=http://localhost:8002</code> in
                    `.env`.
                  </li>
                  <li>Restart Vite dev server after updating environment variables.</li>
                  <li>Ensure LiveKit client version matches backend worker.</li>
                </ul>
                  </div>
              <div>
                <h4 className="font-semibold">Testing Steps</h4>
                <ol className="mt-2 space-y-1 text-muted-foreground">
                  <li>Run backend and confirm `/health` endpoint returns 200.</li>
                  <li>Create interview in setup tab, start session in Live tab.</li>
                  <li>Verify LiveKit connection, audio streaming, and log updates.</li>
                  <li>Review transcripts and analytics post-interview.</li>
                </ol>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => setIsConfigDrawerOpen(false)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AIInterview;