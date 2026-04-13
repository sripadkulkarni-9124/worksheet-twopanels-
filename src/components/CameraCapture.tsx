'use client';

import { useState, useRef, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (images: string[]) => void;
  onCancel: () => void;
  maxPages?: number;
}

export default function CameraCapture({ onCapture, onCancel, maxPages = 10 }: CameraCaptureProps) {
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch {
      // Camera not available, fall back to file input
      fileInputRef.current?.click();
    }
  }, []);

  const captureFromCamera = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImages(prev => [...prev, dataUrl]);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    stopCamera();
    onCapture(capturedImages);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Capture Worksheet Pages</h2>
            <p className="text-sm text-gray-500">
              {capturedImages.length} of {maxPages} pages captured
            </p>
          </div>
          <button onClick={() => { stopCamera(); onCancel(); }} className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isCapturing ? (
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={captureFromCamera}
                  className="w-16 h-16 bg-white rounded-full border-4 border-indigo-500 hover:border-indigo-600 transition-colors flex items-center justify-center"
                >
                  <div className="w-12 h-12 bg-indigo-500 rounded-full" />
                </button>
                <button
                  onClick={stopCamera}
                  className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {capturedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                        Page {idx + 1}
                      </div>
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {capturedImages.length < maxPages && (
                <div className="flex gap-3">
                  <button
                    onClick={startCamera}
                    className="flex-1 flex flex-col items-center gap-2 py-8 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors text-indigo-600"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="text-sm font-medium">Open Camera</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17,8 12,3 7,8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-sm font-medium">Upload Images</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {capturedImages.length > 0 && !isCapturing && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={() => { stopCamera(); onCancel(); }}
              className="px-4 py-2.5 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Evaluate ({capturedImages.length} page{capturedImages.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
