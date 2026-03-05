"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export function MicRecorder({ songId }: { songId: Id<"songs"> }) {
  const createAudioNote = useMutation(api.audioNotes.create);

  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      try {
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        const formData = new FormData();
        formData.append("file", file);
        const result = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!result.ok) throw new Error("Upload failed");
        const { url } = await result.json();

        await createAudioNote({
          songId,
          title: `Recording ${new Date().toLocaleTimeString()}`,
          audioUrl: url,
        });

        toast.success("Recording saved");
      } catch {
        toast.error("Failed to save recording");
      } finally {
        setUploading(false);
      }
    },
    [createAudioNote, songId]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void uploadRecording(blob);
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("Could not access microphone");
    }
  }, [uploadRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5">
      {recording ? (
        <>
          <span className="text-[10px] tabular-nums text-red-500 animate-pulse">
            {formatElapsed(elapsed)}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={stopRecording}
            className="text-red-500 hover:text-red-600"
            title="Stop recording"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        </>
      ) : uploading ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => void startRecording()}
          title="Record audio note"
        >
          <Mic className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
