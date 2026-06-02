import type { ClientRealtimeEvent, ServerRealtimeEvent } from "@runmate/shared";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

export class LiveRunSocket {
  private socket?: WebSocket;

  connect(params: {
    accessToken: string;
    sessionId: string;
    onEvent: (event: ServerRealtimeEvent) => void;
    onStatus?: (status: "connecting" | "open" | "closed" | "error") => void;
  }): void {
    const query = new URLSearchParams({
      token: params.accessToken,
      sessionId: params.sessionId,
    });
    params.onStatus?.("connecting");
    this.socket = new WebSocket(`${WS_URL}?${query.toString()}`);
    this.socket.onopen = () => {
      params.onStatus?.("open");
    };
    this.socket.onmessage = (message) => {
      try {
        params.onEvent(JSON.parse(String(message.data)) as ServerRealtimeEvent);
      } catch {
        // Ignore malformed development events.
      }
    };
    this.socket.onerror = () => {
      params.onStatus?.("error");
    };
    this.socket.onclose = () => {
      params.onStatus?.("closed");
    };
  }

  send(event: ClientRealtimeEvent): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}
