'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppAudioPlayerProps {
  src: string;
  isOutbound?: boolean;
}

export function WhatsAppAudioPlayer({ src, isOutbound = false }: WhatsAppAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [animTick, setAnimTick] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);

  // Animation loop using requestAnimationFrame for smooth updates
  const animate = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      setCurrentTime(audio.currentTime);
      setAnimTick(prev => prev + 1);
      rafRef.current = requestAnimationFrame(animate);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(animate);
    };

    const handlePause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err) {
      console.warn('[AudioPlayer] Play failed:', err);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full">
        <audio ref={audioRef} src={src} preload="auto" />

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
        {/* Waveform bars */}
        <div className="flex items-center gap-[2px] h-8">
          {[...Array(40)].map((_, i) => {
            const isActive = (i / 40) * 100 <= progress;
            const heights = [8, 12, 16, 20, 24, 20, 16, 12, 8, 12, 20, 24, 20, 16, 12, 8, 12, 16, 20, 16, 12, 8, 12, 16, 20, 24, 20, 16, 12, 8, 12, 16, 20, 16, 12, 8, 12, 16, 12, 8];
            const baseHeight = heights[i];
            const animatedHeight = isPlaying && isActive
              ? baseHeight * (1 + 0.3 * Math.sin((animTick * 0.08 + i * 0.7)))
              : baseHeight;

            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-[height] duration-150 ${
                  isActive
                    ? isOutbound
                      ? 'bg-white'
                      : 'bg-primary'
                    : isOutbound
                      ? 'bg-white/40'
                      : 'bg-gray-400'
                }`}
                style={{
                  height: `${animatedHeight}px`,
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
        {formatTime(currentTime || duration)}
      </span>
      </div>
  );
}
