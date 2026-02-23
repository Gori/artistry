import { Id } from "@/convex/_generated/dataModel";

export const STAGES = ["idea", "writing", "producing", "mixing", "done"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

export const STAGE_BADGE_CLASSES: Record<string, string> = {
  idea: "border-stage-idea/25 bg-stage-idea/10 text-stage-idea",
  writing: "border-stage-writing/25 bg-stage-writing/10 text-stage-writing",
  producing: "border-stage-producing/25 bg-stage-producing/10 text-stage-producing",
  mixing: "border-stage-mixing/25 bg-stage-mixing/10 text-stage-mixing",
  done: "border-stage-done/25 bg-stage-done/10 text-stage-done",
};

export const STAGE_COLUMN_CLASSES: Record<Stage, string> = {
  idea: "bg-stage-idea-muted",
  writing: "bg-stage-writing-muted",
  producing: "bg-stage-producing-muted",
  mixing: "bg-stage-mixing-muted",
  done: "bg-stage-done-muted",
};

export const GROUP_COLUMN_CLASSES = [
  "bg-group-1-muted",
  "bg-group-2-muted",
  "bg-group-3-muted",
  "bg-group-4-muted",
  "bg-group-5-muted",
  "bg-group-6-muted",
  "bg-group-7-muted",
  "bg-group-8-muted",
] as const;

export const GROUP_BADGE_CLASSES = [
  "border-group-1/25 bg-group-1/10 text-group-1",
  "border-group-2/25 bg-group-2/10 text-group-2",
  "border-group-3/25 bg-group-3/10 text-group-3",
  "border-group-4/25 bg-group-4/10 text-group-4",
  "border-group-5/25 bg-group-5/10 text-group-5",
  "border-group-6/25 bg-group-6/10 text-group-6",
  "border-group-7/25 bg-group-7/10 text-group-7",
  "border-group-8/25 bg-group-8/10 text-group-8",
] as const;

export interface SongTag {
  _id: Id<"tags">;
  name: string;
  color: string;
}

export interface KanbanSong {
  _id: Id<"songs">;
  title: string;
  slug?: string;
  stage: string;
  position: number;
  description?: string;
  workspaceId: Id<"workspaces">;
  createdBy: Id<"users">;
  tempo?: string;
  key?: string;
  tagIds?: Id<"tags">[];
  tags?: SongTag[];
  groupId?: string;
  groupName?: string;
  groupPosition?: number;
}
