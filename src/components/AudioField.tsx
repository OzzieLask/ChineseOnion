import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

export interface Media {
  url: string | null;
  blob?: Blob;
}

export function AudioField({ value, onChange }: { value: Media; onChange: (m: Media) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rec) return;
    const start = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // mp4/AAC plays on every device (WebM doesn't on older iPhones), so prefer it when supported.
      const mimeType = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus'].find(
        (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        onChange({ url: URL.createObjectURL(blob), blob });
        setRec(null);
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      setErr('Microphone unavailable. Check permissions.');
    }
  };

  const onFile = (f?: File) => {
    if (!f) return;
    onChange({ url: URL.createObjectURL(f), blob: f });
  };

  return (
    <div className="media-field">
      <AnimatePresence mode="wait" initial={false}>
        {rec ? (
          <motion.div key="rec" className="row gap-s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.span
              className="rec-dot"
              animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
            />
            <span className="mono">0:{String(secs).padStart(2, '0')}</span>
            <button type="button" className="btn small danger" onClick={() => rec.stop()}>
              <Icon name="stop" size={16} /> Stop
            </button>
          </motion.div>
        ) : value.url ? (
          <motion.div key="has" className="row gap-s wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <audio src={value.url} controls preload="none" className="audio-el" />
            <button type="button" className="btn ghost small" onClick={() => onChange({ url: null })}>
              <Icon name="trash" size={16} /> Remove
            </button>
          </motion.div>
        ) : (
          <motion.div key="none" className="row gap-s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="btn ghost small" onClick={start}>
              <Icon name="mic" size={16} /> Record
            </button>
            <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Upload
            </button>
            <span className="muted small">Optional. Without a recording, a neural Mandarin voice reads the card.</span>
          </motion.div>
        )}
      </AnimatePresence>
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {err && <p className="error small">{err}</p>}
    </div>
  );
}
