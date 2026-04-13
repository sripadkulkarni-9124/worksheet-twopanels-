'use client';

import { useState, useRef, useCallback } from 'react';

interface CaptureModalProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
}

export default function CaptureModal({ onCapture, onCancel }: CaptureModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      fileInputRef.current?.click();
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setPreview(dataUrl);
  }, [stopCamera]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (preview) onCapture(preview);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex">
      {/* Main area */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Close */}
        <button
          onClick={() => { stopCamera(); onCancel(); }}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {preview ? (
          /* Preview state */
          <div className="w-full h-full flex items-center justify-center p-8">
            <img
              src={preview}
              alt="Captured worksheet"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{ border: '2px solid rgba(232,99,59,0.4)' }}
            />
          </div>
        ) : cameraActive ? (
          /* Live camera */
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          /* Initial state */
          <div className="text-center text-white p-8">
            <div className="text-8xl mb-6">📄</div>
            <h2 className="text-2xl font-bold mb-2">Capture Worksheet</h2>
            <p className="text-gray-400 mb-8 max-w-xs">
              Take one photo of your completed worksheet for AI evaluation
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #E8633B, #C94E2A)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Open Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white font-semibold hover:bg-white/20"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
                Upload Photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-20 flex flex-col items-center justify-between py-8 bg-black/40">
        {/* Thumbnail */}
        <div className="space-y-3">
          {preview && (
            <div className="relative w-14 h-16 rounded-xl overflow-hidden cursor-pointer" style={{ border: '2px solid #E8633B' }}>
              <img src={preview} alt="Page 1" className="w-full h-full object-cover" />
              <button
                onClick={() => setPreview(null)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Confirm */}
          {preview && (
            <button
              onClick={handleConfirm}
              className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white hover:bg-gray-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </button>
          )}

          {/* Capture button */}
          {cameraActive && (
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"
            >
              <div className="w-11 h-11 rounded-full" style={{ backgroundColor: '#E8633B' }} />
            </button>
          )}

          {/* Gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
    </div>
  );
}
