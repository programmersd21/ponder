import { useCallback, useEffect, useRef, useState } from 'react';
import type { Explanation } from './schema.ts';

export type TtsStatus = 'idle' | 'speaking' | 'paused' | 'error';

export type TtsVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
};

export function buildSpeechText(explanation: Explanation): string {
  const parts: string[] = [];
  if (explanation.title) parts.push(`${explanation.title}.`);
  if (explanation.shortAnswer) parts.push(explanation.shortAnswer);

  for (const sec of explanation.sections) {
    if (sec.heading) parts.push(`${sec.heading}.`);
    if (sec.content) {
      const cleaned = sec.content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_]/g, '');
      parts.push(cleaned);
    }
  }

  if (explanation.keyTakeaways && explanation.keyTakeaways.length > 0) {
    parts.push('Key takeaways.');
    explanation.keyTakeaways.forEach((t) => parts.push(t));
  } else if (explanation.keyTakeaway) {
    parts.push(`Key takeaway. ${explanation.keyTakeaway}`);
  }

  return parts.join('\n\n').trim();
}

export function useTextToSpeech() {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  const [status, setStatus] = useState<TtsStatus>('idle');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const requestSeqRef = useRef(0);

  const refreshVoices = useCallback(() => {
    if (!isSupported) return;
    const raw = window.speechSynthesis.getVoices();
    const sorted = [...raw].sort((a, b) => {
      const aEn = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
      const bEn = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return a.name.localeCompare(b.name);
    });
    const mapped = sorted.map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
    }));
    setVoices(mapped);

    setSelectedVoiceURI((prev) => {
      if (prev && mapped.some((v) => v.voiceURI === prev)) return prev;
      const preferred =
        sorted.find((v) => v.default && v.lang.toLowerCase().startsWith('en')) ??
        sorted.find((v) => v.lang.toLowerCase().startsWith('en')) ??
        sorted[0];
      return preferred?.voiceURI ?? '';
    });
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      window.speechSynthesis.cancel();
    };
  }, [isSupported, refreshVoices]);

  const stop = useCallback(() => {
    requestSeqRef.current++;
    utteranceRef.current = null;
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
    setActiveId(null);
    setErrorMessage(null);
  }, [isSupported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!isSupported) {
        setStatus('error');
        setErrorMessage('Audio listening is not supported in this browser.');
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        setStatus('error');
        setErrorMessage('There is no explanation text available to read aloud.');
        return;
      }

      // Cancel any prior active or queued speech cleanly
      const seq = ++requestSeqRef.current;
      window.speechSynthesis.cancel();
      setErrorMessage(null);

      const utterance = new window.SpeechSynthesisUtterance(trimmed);
      utterance.rate = Math.min(2, Math.max(0.5, rate));

      const available = window.speechSynthesis.getVoices();
      const matchedVoice = available.find((v) => v.voiceURI === selectedVoiceURI);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      }

      utterance.onstart = () => {
        if (requestSeqRef.current !== seq) return;
        setStatus('speaking');
        setActiveId(id);
      };

      utterance.onpause = () => {
        if (requestSeqRef.current !== seq) return;
        setStatus('paused');
      };

      utterance.onresume = () => {
        if (requestSeqRef.current !== seq) return;
        setStatus('speaking');
      };

      utterance.onend = () => {
        if (requestSeqRef.current !== seq) return;
        utteranceRef.current = null;
        setStatus('idle');
        setActiveId(null);
      };

      utterance.onerror = (ev) => {
        if (requestSeqRef.current !== seq) return;
        // 'interrupted' or 'canceled' happens intentionally on stop/switch
        if (ev.error === 'interrupted' || ev.error === 'canceled') {
          setStatus('idle');
          setActiveId(null);
          return;
        }
        utteranceRef.current = null;
        setStatus('error');
        setActiveId(null);
        setErrorMessage(
          ev.error === 'synthesis-unavailable' || ev.error === 'voice-unavailable'
            ? 'No speech synthesis voice is available on this device.'
            : 'Audio playback encountered an error in this browser.'
        );
      };

      utteranceRef.current = utterance;
      setActiveId(id);
      setStatus('speaking');
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, rate, selectedVoiceURI]
  );

  const pause = useCallback(() => {
    if (!isSupported || status !== 'speaking') return;
    window.speechSynthesis.pause();
    setStatus('paused');
  }, [isSupported, status]);

  const resume = useCallback(() => {
    if (!isSupported || status !== 'paused') return;
    window.speechSynthesis.resume();
    setStatus('speaking');
  }, [isSupported, status]);

  return {
    isSupported,
    status,
    activeId,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    rate,
    setRate,
    errorMessage,
    speak,
    pause,
    resume,
    stop,
  };
}
