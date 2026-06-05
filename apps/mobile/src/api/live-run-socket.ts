import type { ClientRealtimeEvent, ServerRealtimeEvent } from "@runmate/shared";
import { WS_URL } from "../config/runtime";

export type LiveRunSocketStatus = "connecting" | "open" | "closed" | "error" | "reconnecting";

export interface LiveRunSocketStatusUpdate {
  status: LiveRunSocketStatus;
  attempt: number;
  message: string;
}

interface LiveRunSocketConnectParams {
  accessToken: string;
  sessionId: string;
  onEvent: (event: ServerRealtimeEvent) => void;
  onStatus?: (update: LiveRunSocketStatusUpdate) => void;
}

const MAX_RECONNECT_DELAY_MS = 15000;

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
    this.openSocket("connecting");
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

  private openSocket(status: "connecting" | "reconnecting"): void {
    const params = this.params;
    if (!params || this.closeRequested) {
      return;
    }

    const connectionId = this.connectionId;
    const query = new URLSearchParams({
      token: params.accessToken,
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
    this.socket.onclose = () => {
      if (connectionId !== this.connectionId) {
        return;
      }
      if (this.closeRequested) {
        this.emitStatus("closed", "Live sync closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.params || this.closeRequested) {
      return;
    }
    this.reconnectAttempt += 1;
    const delayMs = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 4));
    this.emitStatus("reconnecting", `Live sync disconnected. Retrying in ${Math.round(delayMs / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.openSocket("reconnecting");
    }, delayMs);
  }

  private emitStatus(status: LiveRunSocketStatus, message: string): void {
    this.params?.onStatus?.({
      status,
      attempt: this.reconnectAttempt,
      message,
    });
  }
}
