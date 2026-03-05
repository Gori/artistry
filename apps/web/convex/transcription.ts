"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";

export const transcribe = internalAction({
  args: {
    audioNoteId: v.id("audioNotes"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.audioNotes.updateTranscription, {
      audioNoteId: args.audioNoteId,
      transcription: "",
      status: "transcribing",
    });

    try {
      const response = await fetch(args.audioUrl);
      const audioBlob = await response.blob();
      const audioFile = new File([audioBlob], "audio.webm", {
        type: audioBlob.type,
      });

      const openai = new OpenAI();
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      await ctx.runMutation(internal.audioNotes.updateTranscription, {
        audioNoteId: args.audioNoteId,
        transcription: transcriptionResult.text,
        status: "transcribed",
      });
    } catch (error) {
      console.error("Transcription failed:", error);
      const isTooBig =
        error instanceof Error &&
        (error.message.includes("Maximum content size limit") ||
          ("status" in error && (error as { status: number }).status === 413));
      await ctx.runMutation(internal.audioNotes.updateTranscription, {
        audioNoteId: args.audioNoteId,
        transcription: isTooBig
          ? "File too large for transcription (max 25 MB). Try uploading a shorter or more compressed file."
          : "",
        status: "failed",
      });
    }
  },
});
