export const VERSION_CATEGORIES = ["demo", "rough", "mix", "final"] as const;
export type VersionCategory = (typeof VERSION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<VersionCategory, string> = {
  demo: "Demo",
  rough: "Rough",
  mix: "Mix",
  final: "Final",
};

export const CATEGORY_COLORS: Record<
  VersionCategory,
  { bg: string; text: string; dot: string }
> = {
  demo: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  rough: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  mix: {
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  final: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};
