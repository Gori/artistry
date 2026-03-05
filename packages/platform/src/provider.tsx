"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface UploadResult {
  url: string;
}

export interface PlatformAdapter {
  uploadAudio: (file: File) => Promise<UploadResult>;
  uploadImage: (file: File) => Promise<UploadResult>;
}

const PlatformContext = createContext<PlatformAdapter | null>(null);

export function PlatformProvider({
  adapter,
  children,
}: {
  adapter: PlatformAdapter;
  children: ReactNode;
}) {
  return (
    <PlatformContext.Provider value={adapter}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformAdapter {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return ctx;
}
