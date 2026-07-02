export const RUNMATE_THEME_IDS = ["classic", "sunny-sprint", "adventure-trail"] as const;

export type RunMateThemeId = (typeof RUNMATE_THEME_IDS)[number];

export interface RunMateTheme {
  id: RunMateThemeId;
  name: string;
  shortName: string;
  description: string;
  previewWords: string[];
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    primaryText: string;
    secondaryBorder: string;
    text: string;
    mutedText: string;
    tabActiveBackground: string;
    metricStrongBackground: string;
    metricStrongLabel: string;
    accentSoftBackground: string;
    accentBorder: string;
    accentText: string;
  };
}

export const RUNMATE_THEMES: RunMateTheme[] = [
  {
    id: "classic",
    name: "RunMate Classic",
    shortName: "Classic",
    description: "Clean running app style with calm teal highlights.",
    previewWords: ["steady", "clear", "ready"],
    colors: {
      accentBorder: "#bfdbfe",
      accentSoftBackground: "#eff6ff",
      accentText: "#1d4ed8",
      background: "#f8fafc",
      metricStrongBackground: "#0f766e",
      metricStrongLabel: "#ccfbf1",
      mutedText: "#64748b",
      primary: "#0f766e",
      primaryText: "#ffffff",
      secondaryBorder: "#cbd5e1",
      surface: "#ffffff",
      surfaceAlt: "#f8fafc",
      tabActiveBackground: "#0f766e",
      text: "#0f172a",
    },
  },
  {
    id: "sunny-sprint",
    name: "Sunny Sprint",
    shortName: "Sunny",
    description: "Bright family style with warm sunshine and sky colors.",
    previewWords: ["sunny", "fast", "smile"],
    colors: {
      accentBorder: "#fed7aa",
      accentSoftBackground: "#fff7ed",
      accentText: "#c2410c",
      background: "#fefce8",
      metricStrongBackground: "#ea580c",
      metricStrongLabel: "#ffedd5",
      mutedText: "#6b7280",
      primary: "#0284c7",
      primaryText: "#ffffff",
      secondaryBorder: "#fbbf24",
      surface: "#ffffff",
      surfaceAlt: "#ecfeff",
      tabActiveBackground: "#0284c7",
      text: "#111827",
    },
  },
  {
    id: "adventure-trail",
    name: "Adventure Trail",
    shortName: "Trail",
    description: "Outdoor exploration style with trail green and energetic orange.",
    previewWords: ["trail", "explore", "finish"],
    colors: {
      accentBorder: "#bbf7d0",
      accentSoftBackground: "#f0fdf4",
      accentText: "#166534",
      background: "#f7fee7",
      metricStrongBackground: "#15803d",
      metricStrongLabel: "#dcfce7",
      mutedText: "#52616b",
      primary: "#166534",
      primaryText: "#ffffff",
      secondaryBorder: "#86efac",
      surface: "#ffffff",
      surfaceAlt: "#f0fdf4",
      tabActiveBackground: "#166534",
      text: "#102a1b",
    },
  },
];

export function getRunMateTheme(themeId: string | undefined): RunMateTheme {
  return RUNMATE_THEMES.find((theme) => theme.id === themeId) ?? RUNMATE_THEMES[0];
}
