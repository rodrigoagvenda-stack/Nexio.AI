'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Trash2, Pause, Send, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSendAudio, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-start recording quando monta
    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
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

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Não foi possível acessar o microfone');
      onCancel();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleDelete = () => {
    if (isRecording) {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    if (audioURL) URL.revokeObjectURL(audioURL);
    onCancel();
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, duration);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    } else {
      audioRef.current.play();
      setIsPlaying(true);

      // Update playback time
      playbackTimerRef.current = setInterval(() => {
        if (audioRef.current) {
          setPlaybackTime(Math.floor(audioRef.current.currentTime));
        }
      }, 100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-muted border-t py-3 px-4">
      {isRecording ? (
        // Gravando - VendAI style
        <div className="flex items-center gap-3">
          {/* Ícone microfone */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary">
            <Mic className="h-5 w-5 text-primary-foreground" />
          </div>

          {/* Botão deletar */}
          <Button
            onClick={handleDelete}
            size="icon"
            variant="ghost"
            className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          {/* Timer + Waveform */}
          <div className="flex-1 flex items-center gap-3">
            {/* Timer com bolinha vermelha */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-500 font-mono text-sm tabular-nums font-semibold">
                {formatTime(recordingTime)}
              </span>
            </div>

            {/* Waveform animado */}
            <div className="flex items-center gap-[2px] h-8">
              {[...Array(30)].map((_, i) => {
                const heights = [4, 8, 12, 16, 20, 16, 12, 8, 4, 8, 16, 20, 16, 12, 8, 4, 8, 12, 16, 12, 8, 4, 8, 12, 16, 20, 16, 12, 8, 4];
                const height = isPaused ? 4 : heights[i];

                return (
                  <div
                    key={i}
                    className="w-[2px] bg-muted-foreground/40 rounded-full transition-all duration-75"
                    style={{
                      height: `${height}px`,
                      animation: isPaused ? 'none' : `pulse ${0.5 + (i % 3) * 0.2}s ease-in-out infinite`
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Botão pause/resume */}
          <Button
            onClick={isPaused ? resumeRecording : pauseRecording}
            size="icon"
            variant="ghost"
            className="h-10 w-10"
          >
            {isPaused ? (
              <Mic className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>

          {/* Botão parar gravação para preview */}
          <Button
            onClick={stopRecording}
            size="icon"
            variant="default"
            className="h-10 w-10"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Preview após gravar - VendAI style
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause button */}
            <Button
              onClick={togglePlayPause}
              size="icon"
              variant="outline"
              className="h-10 w-10 flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
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
              src={audioURL || ''}
              onEnded={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
                if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
              }}
            />

            {/* Botão deletar */}
            <Button
              onClick={handleDelete}
              size="icon"
              variant="ghost"
              className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-5 w-5" />
            </Button>

            {/* Botão enviar */}
            <Button
              onClick={handleSend}
              size="icon"
              className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            >
              <Send className="h-5 w-5" fill="currentColor" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Ouça o áudio antes de enviar
          </p>
        </div>
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
