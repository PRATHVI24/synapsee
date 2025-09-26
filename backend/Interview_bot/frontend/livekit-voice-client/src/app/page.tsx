'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Room,
  createLocalAudioTrack,
  RoomEvent,
  Track,
  LocalAudioTrack,
} from 'livekit-client';

// Configuration matching your Django backend with normalized structure
const CONFIG = {
  apiUrl: 'http://127.0.0.1:8000',
  organization: 'test_org',
  referenceNumber: 'NORMALIZED_TEST_001',
  participantName: 'candidate_prajwal',
  roomName: 'interview_NORMALIZED_TEST_001'
};

interface TokenResponse {
  success: boolean;
  token: string;
  livekit_url: string;
  room_name: string;
  participant_name: string;
}

export default function VoiceInterviewPage() {
  const [status, setStatus] = useState('Ready to start voice interview');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);

  const updateStatus = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setStatus(`[${timestamp}] ${message}`);
    setStatusType(type);
    console.log(`[${timestamp}] ${message}`);
  }, []);

  const getTokenFromBackend = async (): Promise<TokenResponse> => {
    try {
      // Step 1: Initialize interview
      updateStatus('Initializing interview backend...', 'info');
      const initResponse = await fetch(`${CONFIG.apiUrl}/start_livekit_interview/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Organization': CONFIG.organization
        },
        body: JSON.stringify({
          ref_num: CONFIG.referenceNumber,
          custom_duration: 30
        })
      });

      if (!initResponse.ok) {
        throw new Error(`Init failed: ${initResponse.status} - ${await initResponse.text()}`);
      }

      // Step 2: Get token
      updateStatus('Getting access token...', 'info');
      const tokenResponse = await fetch(
        `${CONFIG.apiUrl}/get_livekit_token/?ref_num=${CONFIG.referenceNumber}&participant_name=${CONFIG.participantName}&room_name=${CONFIG.roomName}`,
        {
          method: 'GET',
          headers: { 'Organization': CONFIG.organization }
        }
      );

      if (!tokenResponse.ok) {
        throw new Error(`Token failed: ${tokenResponse.status} - ${await tokenResponse.text()}`);
      }

      const tokenData = await tokenResponse.json();
      return tokenData;

    } catch (error) {
      console.error('Backend error:', error);
      throw error;
    }
  };

  const handleParticipantUpdate = useCallback(() => {
    if (!room) {
      setParticipants([]);
      return;
    }
    
    const participantIdentities = Array.from(room.participants.values()).map(p => p.identity);
    setParticipants(participantIdentities);
  }, [room]);

  const startVoiceInterview = async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    updateStatus('Starting voice interview...', 'info');

    try {
      // Get token from backend
      const { token, livekit_url } = await getTokenFromBackend();
      updateStatus('✅ Token received, connecting to LiveKit...', 'success');

      // Create room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event handlers
      newRoom.on(RoomEvent.Connected, () => {
        updateStatus('🎉 Connected to LiveKit! Setting up microphone...', 'success');
        setIsConnected(true);
        setRoom(newRoom);
        handleParticipantUpdate();
        enableMicrophone(newRoom);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        updateStatus(`👤 ${participant.identity} joined the interview`, 'info');
        handleParticipantUpdate();
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        updateStatus(`👋 ${participant.identity} left the interview`, 'info');
        handleParticipantUpdate();
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          updateStatus(`🔊 Now receiving audio from ${participant.identity}`, 'success');
          const audioElement = track.attach();
          audioElement.autoplay = true;
          document.body.appendChild(audioElement);
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        updateStatus('📴 Disconnected from interview', 'info');
        setIsConnected(false);
        setRoom(null);
        setLocalAudioTrack(null);
        setParticipants([]);
      });

      // Connect to the room
      await newRoom.connect(livekit_url, token);

    } catch (error) {
      updateStatus(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const enableMicrophone = async (room: Room) => {
    try {
      updateStatus('🎤 Enabling microphone...', 'info');

      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      await room.localParticipant.publishTrack(audioTrack);
      setLocalAudioTrack(audioTrack);
      
      updateStatus('🎤✅ Microphone active! Speak to the AI interviewer. Agent should join shortly...', 'success');

    } catch (error) {
      updateStatus(`❌ Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      console.error('Microphone error:', error);
    }
  };

  const stopVoiceInterview = async () => {
    updateStatus('Stopping interview...', 'info');

    try {
      if (localAudioTrack) {
        localAudioTrack.stop();
        setLocalAudioTrack(null);
      }

      if (room) {
        await room.disconnect();
      }

      // Stop backend interview
      await fetch(`${CONFIG.apiUrl}/stop_livekit_interview/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Organization': CONFIG.organization
        },
        body: JSON.stringify({ ref_num: CONFIG.referenceNumber })
      });

      updateStatus('✅ Interview stopped successfully', 'success');

    } catch (error) {
      updateStatus(`❌ Stop error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      console.error('Stop error:', error);
    }
  };

  const getStatusColor = () => {
    switch (statusType) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-8">
            🎤 LiveKit Voice Interview Client
          </h1>
          
          {/* Connection Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Connection Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Organization:</strong> {CONFIG.organization}</div>
              <div><strong>Interview:</strong> {CONFIG.referenceNumber}</div>
              <div><strong>Candidate:</strong> Prajwal</div>
              <div><strong>Room:</strong> {CONFIG.roomName}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={startVoiceInterview}
              disabled={isConnecting || isConnected}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2"
            >
              <span>🎤</span>
              <span>{isConnecting ? 'Connecting...' : 'Start Voice Interview'}</span>
            </button>
            
            <button
              onClick={stopVoiceInterview}
              disabled={!isConnected}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2"
            >
              <span>🔴</span>
              <span>Stop Interview</span>
            </button>
          </div>

          {/* Status */}
          <div className={`rounded-lg p-4 border ${getStatusColor()} mb-8`}>
            <div className="font-mono text-sm">{status}</div>
          </div>

          {/* Participants */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Connected Participants</h3>
            {participants.length > 0 ? (
              <div className="space-y-2">
                {participants.map((identity, index) => (
                  <div key={index} className="bg-white rounded p-3 border-l-4 border-blue-500">
                    🎤 {identity}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-600">
                {isConnected ? 'Only you are connected' : 'No participants connected'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
