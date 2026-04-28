import { useState, useCallback } from 'react';

export type MediaAttachment =
  | { kind: 'screenshot'; blob: Blob; previewUrl: string }
  | { kind: 'recording'; blob: Blob; previewUrl: string };

export function useMediaCapture() {
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureScreenshot = useCallback(async () => {
    setIsCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        setAttachment({ kind: 'screenshot', blob, previewUrl: canvas.toDataURL('image/png') });
      }, 'image/png');
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const recordScreen = useCallback(async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        setAttachment({ kind: 'recording', blob, previewUrl: URL.createObjectURL(blob) });
        setIsCapturing(false);
      };

      recorder.start();
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 60_000);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      });
    } catch {
      setIsCapturing(false);
    }
  }, []);

  const clearAttachment = useCallback(() => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }, [attachment]);

  return { attachment, isCapturing, captureScreenshot, recordScreen, clearAttachment };
}
