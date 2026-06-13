import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "runmate.lastApiDiagnostic.v1";

export interface LastApiDiagnostic {
  path: string;
  status: number;
  reason: string;
  url?: string;
  timeoutMs?: number;
  updatedAt: string;
}

export async function loadLastApiDiagnostic(): Promise<LastApiDiagnostic | undefined> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as LastApiDiagnostic;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

export async function saveLastApiDiagnostic(diagnostic: Omit<LastApiDiagnostic, "updatedAt">): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...diagnostic,
      updatedAt: new Date().toISOString(),
    }),
  );
}
