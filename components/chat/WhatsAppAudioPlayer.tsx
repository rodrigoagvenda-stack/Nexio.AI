'use client';

import { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppAudioPlayerProps {
  src: string;
  isOutbound?: boolean;
}

export function WhatsAppAudioPlayer({ src, isOutbound = false }: WhatsAppAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (playbackTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onDurationChange={(e) => {
          const audio = e.currentTarget;
          if (audio.duration && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onTimeUpdate={(e) => {
          setPlaybackTime(Math.floor(e.currentTarget.currentTime));
        }}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackTime(0);
        }}
      />

      {/* Play/Pause Button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={togglePlay}
        className={`h-10 w-10 rounded-full flex-shrink-0 ${
          isOutbound
            ? 'hover:bg-white/20'
            : 'hover:bg-muted-foreground/10'
        }`}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" fill="currentColor" />
        ) : (
          <Play className="h-5 w-5" fill="currentColor" />
        )}
      </Button>

      {/* Waveform / Progress Container */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-[2px] h-8">
          {[...Array(40)].map((_, i) => {
            const heights = [8, 12, 16, 20, 24, 20, 16, 12, 8, 12, 20, 24, 20, 16, 12, 8, 12, 16, 20, 16, 12, 8, 12, 16, 20, 24, 20, 16, 12, 8, 12, 16, 20, 16, 12, 8, 12, 16, 12, 8];
            const isActive = (i / 40) * 100 <= progress;

            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-colors ${
                  isActive
                    ? isOutbound
                      ? 'bg-white'
                      : 'bg-primary'
                    : isOutbound
                      ? 'bg-white/40'
                      : 'bg-gray-400'
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
      </div>

      {/* Time Display */}
      <span className={`text-xs tabular-nums flex-shrink-0 ${
        isOutbound ? 'opacity-80' : 'text-muted-foreground'
      }`}>
        {formatTime(isPlaying ? playbackTime : duration)}
      </span>

      <style jsx>{`
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
