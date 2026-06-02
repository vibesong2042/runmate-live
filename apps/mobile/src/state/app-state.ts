export type AppScreen = "home" | "friends" | "runSetup" | "liveRun" | "result" | "profile" | "settings";

export interface FriendSummary {
  id: string;
  nickname: string;
  status: "online" | "running" | "offline";
  currentPace?: string;
}

export const demoFriends: FriendSummary[] = [
  { id: "friend-1", nickname: "Minsu", status: "running", currentPace: "5:48" },
  { id: "friend-2", nickname: "Jihyun", status: "online" },
  { id: "friend-3", nickname: "Seoyeon", status: "offline" },
];
