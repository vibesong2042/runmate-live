import {
  calculateReconnectDelayMs,
  hasExceededReconnectAttempts,
  type ClientRealtimeEvent,
  type ServerRealtimeEvent,
} from "@runmate/shared";
import { WS_URL } from "../config/runtime";

export type LiveRunSocketStatus = "connecting" | "open" | "closed" | "error" | "reconnecting" | "offline";

export interface LiveRunSocketStatusUpdate {
  status: LiveRunSocketStatus;
  attempt: number;
  message: string;
  closeCode?: number;
}

interface LiveRunSocketConnectParams {
  getAccessToken: () => Promise<string>;
  sessionId: string;
  onEvent: (event: ServerRealtimeEvent) => void;
  onStatus?: (update: LiveRunSocketStatusUpdate) => void;
}

export class LiveRunSocket {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private closeRequested = false;
  private params?: LiveRunSocketConnectParams;
  private connectionId = 0;

  connect(params: LiveRunSocketConnectParams): void {
    this.closeRequested = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
    this.connectionId += 1;
    this.params = params;
    this.closeRequested = false;
    this.reconnectAttempt = 0;
    void this.openSocket("connecting");
  }

  send(event: ClientRealtimeEvent): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  close(): void {
    this.closeRequested = true;
    this.connectionId += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
  }

  private async openSocket(status: "connecting" | "reconnecting"): Promise<void> {
    const params = this.params;
    if (!params || this.closeRequested) {
      return;
    }

    const connectionId = this.connectionId;
    let accessToken: string;
    try {
      accessToken = await params.getAccessToken();
    } catch {
      this.emitStatus("offline", "Server connection failed - run is saved locally");
      return;
    }

    if (connectionId !== this.connectionId || this.closeRequested) {
      return;
    }

    const query = new URLSearchParams({
      token: accessToken,
      sessionId: params.sessionId,
    });
    this.emitStatus(status, status === "connecting" ? "Opening live sync" : "Reconnecting live sync");
    this.socket = new WebSocket(`${WS_URL}?${query.toString()}`);
    this.socket.onopen = () => {
      if (connectionId !== this.connectionId) {
        return;
      }
      this.reconnectAttempt = 0;
      this.emitStatus("open", "Live sync connected");
    };
    this.socket.onmessage = (message) => {
      if (connectionId !== this.connectionId) {
        return;
      }
      try {
        params.onEvent(JSON.parse(String(message.data)) as ServerRealtimeEvent);
      } catch {
        // Ignore malformed development events.
      }
    };
    this.socket.onerror = () => {
      if (connectionId !== this.connectionId) {
        return;
      }
      this.emitStatus("error", `Live sync error while connecting to ${WS_URL}`);
    };
    this.socket.onclose = (event) => {
      if (connectionId !== this.connectionId) {
        return;
      }
      if (this.closeRequested) {
        this.emitStatus("closed", "Live sync closed", event.code);
        return;
      }
      this.scheduleReconnect(event.code);
    };
  }

  private scheduleReconnect(closeCode?: number): void {
    if (!this.params || this.closeRequested) {
      return;
    }
    this.reconnectAttempt += 1;
    if (hasExceededReconnectAttempts(this.reconnectAttempt)) {
      this.emitStatus("offline", "Server connection failed - run is saved locally", closeCode);
      return;
    }
    const delayMs = calculateReconnectDelayMs(this.reconnectAttempt);
    this.emitStatus("reconnecting", `Live sync disconnected. Retrying in ${Math.round(delayMs / 1000)}s`, closeCode);
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket("reconnecting");
    }, delayMs);
  }

  private emitStatus(status: LiveRunSocketStatus, message: string, closeCode?: number): void {
    this.params?.onStatus?.({
      status,
      attempt: this.reconnectAttempt,
      message,
      closeCode,
    });
  }
}
