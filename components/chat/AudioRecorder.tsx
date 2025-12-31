'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, X, Send } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSendAudio, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioURL) URL.revokeObjectURL(audioURL);
      stopMediaStream();
    };
  }, []);

  const stopMediaStream = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use audio/webm;codecs=opus para melhor compatibilidade
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        setAudioBlob(audioBlob);
        setDuration(recordingTime);
        stopMediaStream();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer para mostrar tempo de gravação
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, duration);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
      {!audioURL ? (
        <>
          {/* Gravando */}
          {isRecording ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                </div>
                <span className="text-sm text-muted-foreground">Gravando áudio...</span>
              </div>
              <Button
                onClick={stopRecording}
                size="icon"
                variant="destructive"
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              {/* Iniciar gravação */}
              <span className="text-sm text-muted-foreground flex-1">
                Clique no microfone para gravar
              </span>
              <Button
                onClick={startRecording}
                size="icon"
                variant="default"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            onClick={handleCancel}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          {/* Preview do áudio */}
          <div className="flex items-center gap-2 flex-1">
            <Button
              onClick={togglePlayPause}
              size="icon"
              variant="outline"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Waveform + Time */}
            <div className="flex-1 flex items-center gap-3">
              {/* Waveform */}
              <div className="flex items-center gap-[2px] h-8 flex-1">
                {[...Array(40)].map((_, i) => {
                  const heights = [4, 8, 12, 16, 20, 16, 12, 8, 4, 8, 16, 20, 16, 12, 8, 4, 8, 12, 16, 12, 8, 4, 8, 12, 16, 20, 16, 12, 8, 4, 8, 12, 16, 20, 16, 12, 8, 4, 8, 12];
                  const progress = duration > 0 ? (playbackTime / duration) * 100 : 0;
                  const isActive = (i / 40) * 100 <= progress;

                  return (
                    <div
                      key={i}
                      className={`w-[2px] rounded-full transition-colors ${
                        isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`}
                      style={{
                        height: `${heights[i]}px`,
                        animation: isPlaying && isActive
                          ? `audioPulse ${0.8 + (i % 3) * 0.2}s ease-in-out infinite`
                          : 'none'
                      }}
                    />
                  );
                })}
              </div>

              {/* Time */}
              <span className="text-sm font-mono tabular-nums text-muted-foreground flex-shrink-0">
                {formatTime(isPlaying ? playbackTime : duration)}
              </span>
            </div>
            <audio
              ref={audioRef}
              src={audioURL}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
          <Button
            onClick={handleSend}
            size="icon"
            variant="default"
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleCancel}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
        @keyframes audioPulse {
          0%, 100% {
            transform: scaleY(1);
            opacity: 1;
          }
          50% {
            transform: scaleY(1.3);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
