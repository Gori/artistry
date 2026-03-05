"use client";

import { X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
interface ReferenceCardProps {
  type: "image" | "link" | "text" | "color";
  content: string;
  title?: string;
  onDelete: () => void;
}

export function ReferenceCard({ type, content, title, onDelete }: ReferenceCardProps) {

  return (
    <div className="group relative rounded-lg border bg-card overflow-hidden">
      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80"
        onClick={onDelete}
      >
        <X className="size-3" />
      </Button>

      {type === "image" && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={content}
            alt={title ?? "Reference image"}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {type === "color" && (
        <div
          className="h-20 w-full"
          style={{ backgroundColor: content }}
        />
      )}

      {type === "link" && (
        <a
          href={content}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-2">
            <Link2 className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {title ?? content}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {content}
              </p>
            </div>
          </div>
        </a>
      )}

      {type === "text" && (
        <div className="p-3">
          <p className="text-xs whitespace-pre-wrap line-clamp-4">{content}</p>
        </div>
      )}

      {/* Title bar for image and color */}
      {(type === "image" || type === "color") && title && (
        <div className="px-3 py-1.5 border-t">
          <p className="text-[10px] text-muted-foreground truncate">{title}</p>
        </div>
      )}

      {type === "color" && (
        <div className="px-3 py-1.5 border-t">
          <p className="text-[10px] font-mono text-muted-foreground">{content}</p>
        </div>
      )}
    </div>
  );
}
