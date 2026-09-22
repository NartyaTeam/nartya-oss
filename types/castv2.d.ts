declare module "castv2-client" {
  import type { EventEmitter } from "node:events";

  export type MediaStatus = {
    playerState?: string;
    idleReason?: string;
    currentTime?: number;
    media?: { duration?: number };
    volume?: { level?: number; muted?: boolean };
  };

  export type ReceiverStatus = { volume?: { level?: number; muted?: boolean } };

  export type LoadRequest = {
    contentId: string;
    contentType: string;
    streamType: "BUFFERED" | "LIVE";
    metadata: {
      type: number;
      metadataType: number;
      title: string;
      images: { url: string }[];
    };
  };

  export type Volume = { level?: number; muted?: boolean };

  export type Callback<T> = (error: Error | null, value: T) => void;

  export class DefaultMediaReceiver extends EventEmitter {
    media: { currentSession: MediaStatus | null };
    load(
      media: LoadRequest,
      options: { autoplay: boolean; currentTime: number },
      done: Callback<MediaStatus>,
    ): void;
    getStatus(done: Callback<MediaStatus>): void;
    play(done: Callback<MediaStatus>): void;
    pause(done: Callback<MediaStatus>): void;
    seek(currentTime: number, done: Callback<MediaStatus>): void;
  }

  export class Client extends EventEmitter {
    connect(options: { host: string; port: number }, connected: () => void): void;
    launch(application: typeof DefaultMediaReceiver, done: Callback<DefaultMediaReceiver>): void;
    setVolume(volume: Volume, done: Callback<Volume>): void;
    getVolume(done: Callback<Volume>): void;
    close(): void;
  }
}

declare module "castv2" {
  import type { EventEmitter } from "node:events";
  import type tls from "node:tls";

  export class Server extends EventEmitter {
    server: tls.Server;
    constructor(options: tls.TlsOptions);
    listen(port: number, host: string, listening: () => void): void;
    send(
      clientId: string,
      sourceId: string,
      destinationId: string,
      namespace: string,
      data: string,
    ): void;
    close(): void;
  }
}
