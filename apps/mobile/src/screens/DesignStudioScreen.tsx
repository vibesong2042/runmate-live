import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RUNMATE_THEMES, type RunMateTheme, type RunMateThemeId } from "@runmate/shared";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { RunMateThemeProvider } from "../theme/RunMateThemeContext";

interface DesignStudioScreenProps {
  activeThemeId: RunMateThemeId;
  onBack: () => void;
  onResetTheme: () => Promise<void>;
  onUseTheme: (themeId: RunMateThemeId) => Promise<void>;
}

export function DesignStudioScreen({ activeThemeId, onBack, onResetTheme, onUseTheme }: DesignStudioScreenProps) {
  const [previewThemeId, setPreviewThemeId] = useState<RunMateThemeId>(activeThemeId);
  const [status, setStatus] = useState("Pick a style together.");
  const previewTheme = RUNMATE_THEMES.find((theme) => theme.id === previewThemeId) ?? RUNMATE_THEMES[0];

  async function saveTheme() {
    await onUseTheme(previewTheme.id);
    setStatus("Saved for this runner.");
  }

  async function resetTheme() {
    await onResetTheme();
    setPreviewThemeId("classic");
    setStatus("Reset to Classic.");
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: previewTheme.colors.background }]}>
      <View>
        <Text style={[styles.kicker, { color: previewTheme.colors.primary }]}>Design Studio</Text>
        <Text style={[styles.title, { color: previewTheme.colors.text }]}>Pick your app style.</Text>
        <Text style={[styles.body, { color: previewTheme.colors.mutedText }]}>
          Choose a look with your child. Running screens stay clear and safe.
        </Text>
      </View>

      <View style={styles.themeList}>
        {RUNMATE_THEMES.map((theme) => (
          <ThemeChoiceCard
            isActive={theme.id === activeThemeId}
            isPreviewing={theme.id === previewThemeId}
            key={theme.id}
            onPress={() => {
              setPreviewThemeId(theme.id);
              setStatus(`Previewing ${theme.shortName}.`);
            }}
            theme={theme}
          />
        ))}
      </View>

      <RunMateThemeProvider theme={previewTheme}>
        <View style={[styles.previewPanel, { borderColor: previewTheme.colors.accentBorder, backgroundColor: previewTheme.colors.surface }]}>
          <Text style={[styles.panelTitle, { color: previewTheme.colors.text }]}>Preview</Text>
          <View style={styles.metricsRow}>
            <MetricTile label="This Week" value="12.4 km" tone="strong" />
            <MetricTile label="Runs" value="3" />
          </View>
          <PrimaryButton label="Run With Friends" onPress={() => undefined} />
          <PrimaryButton label="Invite Friends" variant="secondary" onPress={() => undefined} />
        </View>
      </RunMateThemeProvider>

      <Text style={[styles.status, { color: previewTheme.colors.accentText }]}>{status}</Text>

      <View style={styles.actions}>
        <PrimaryButton label="Use this style" onPress={() => void saveTheme()} />
        <PrimaryButton label="Reset to Classic" variant="secondary" onPress={() => void resetTheme()} />
        <PrimaryButton label="Back" variant="secondary" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

function ThemeChoiceCard({
  isActive,
  isPreviewing,
  onPress,
  theme,
}: {
  isActive: boolean;
  isPreviewing: boolean;
  onPress: () => void;
  theme: RunMateTheme;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.themeCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isPreviewing ? theme.colors.primary : theme.colors.accentBorder,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.swatches}>
          <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.metricStrongBackground }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.accentSoftBackground }]} />
        </View>
        {isActive ? <Text style={[styles.badge, { backgroundColor: theme.colors.accentSoftBackground, color: theme.colors.accentText }]}>Active</Text> : null}
      </View>
      <Text style={[styles.themeName, { color: theme.colors.text }]}>{theme.name}</Text>
      <Text style={[styles.themeDescription, { color: theme.colors.mutedText }]}>{theme.description}</Text>
      <Text style={[styles.previewWords, { color: theme.colors.accentText }]}>{theme.previewWords.join(" / ")}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  body: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 10,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  previewPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  previewWords: {
    fontSize: 12,
    fontWeight: "900",
  },
  status: {
    fontSize: 13,
    fontWeight: "900",
  },
  swatch: {
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  swatches: {
    flexDirection: "row",
    gap: 6,
  },
  themeCard: {
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
    padding: 14,
  },
  themeDescription: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  themeList: {
    gap: 10,
  },
  themeName: {
    fontSize: 17,
    fontWeight: "900",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    marginTop: 8,
  },
});
