import {
  FilePlus,
  FileMinus,
  FileEdit,
  FileSymlink,
} from "lucide-react";
import { cn } from "../utils";

export interface DiffSummaryProps {
  summary: {
    added: number;
    removed: number;
    modified: number;
    renamed: number;
  };
  className?: string;
}

export function DiffSummary({ summary, className }: DiffSummaryProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 text-xs", className)}>
      {summary.added > 0 && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <FilePlus className="size-3" />
          {summary.added} added
        </span>
      )}
      {summary.removed > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <FileMinus className="size-3" />
          {summary.removed} removed
        </span>
      )}
      {summary.modified > 0 && (
        <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
          <FileEdit className="size-3" />
          {summary.modified} modified
        </span>
      )}
      {summary.renamed > 0 && (
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <FileSymlink className="size-3" />
          {summary.renamed} renamed
        </span>
      )}
    </div>
  );
}
