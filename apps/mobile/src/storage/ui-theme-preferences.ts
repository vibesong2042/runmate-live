import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRunMateTheme, RUNMATE_THEME_IDS, type RunMateTheme, type RunMateThemeId } from "@runmate/shared";

const THEME_KEY_PREFIX = "runmate.uiTheme.v1";

export async function loadRunMateThemePreference(userId: string): Promise<RunMateTheme> {
  const stored = await AsyncStorage.getItem(getThemeKey(userId));
  return getRunMateTheme(isRunMateThemeId(stored) ? stored : undefined);
}

export async function saveRunMateThemePreference(userId: string, themeId: RunMateThemeId): Promise<RunMateTheme> {
  await AsyncStorage.setItem(getThemeKey(userId), themeId);
  return getRunMateTheme(themeId);
}

export async function resetRunMateThemePreference(userId: string): Promise<RunMateTheme> {
  await AsyncStorage.removeItem(getThemeKey(userId));
  return getRunMateTheme("classic");
}

function getThemeKey(userId: string): string {
  return `${THEME_KEY_PREFIX}:${userId}`;
}

function isRunMateThemeId(value: string | null): value is RunMateThemeId {
  return RUNMATE_THEME_IDS.includes(value as RunMateThemeId);
}
