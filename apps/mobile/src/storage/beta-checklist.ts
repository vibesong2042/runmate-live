import AsyncStorage from "@react-native-async-storage/async-storage";

export const BETA_CHECKLIST_STORAGE_KEY = "runmate.betaChecklist.v1";

export interface BetaChecklistItem {
  id: BetaChecklistItemId;
  label: string;
}

export type BetaChecklistItemId =
  | "login"
  | "friend_connection"
  | "group_run"
  | "map_display"
  | "pace_location"
  | "send_cheer"
  | "finish_save"
  | "restart_history";

export interface BetaChecklistItemState {
  checked: boolean;
  checkedAt?: string;
}

export type BetaChecklistState = Record<BetaChecklistItemId, BetaChecklistItemState>;

export const BETA_CHECKLIST_ITEMS: BetaChecklistItem[] = [
  { id: "login", label: "Login" },
  { id: "friend_connection", label: "Friend connection" },
  { id: "group_run", label: "Create or join group run" },
  { id: "map_display", label: "Map display" },
  { id: "pace_location", label: "Location and pace update" },
  { id: "send_cheer", label: "Send Cheer" },
  { id: "finish_save", label: "Finish save" },
  { id: "restart_history", label: "Restart and history check" },
];

export function createEmptyChecklistState(): BetaChecklistState {
  return Object.fromEntries(
    BETA_CHECKLIST_ITEMS.map((item) => [item.id, { checked: false }]),
  ) as BetaChecklistState;
}

export async function loadBetaChecklist(): Promise<BetaChecklistState> {
  const raw = await AsyncStorage.getItem(BETA_CHECKLIST_STORAGE_KEY);
  if (!raw) {
    return createEmptyChecklistState();
  }

  try {
    return {
      ...createEmptyChecklistState(),
      ...(JSON.parse(raw) as Partial<BetaChecklistState>),
    };
  } catch {
    await AsyncStorage.removeItem(BETA_CHECKLIST_STORAGE_KEY);
    return createEmptyChecklistState();
  }
}

export async function saveBetaChecklist(state: BetaChecklistState): Promise<void> {
  await AsyncStorage.setItem(BETA_CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

export async function resetBetaChecklist(): Promise<BetaChecklistState> {
  const next = createEmptyChecklistState();
  await saveBetaChecklist(next);
  return next;
}
