import EventEmitter from "events";

export class LLMEventEmitter extends EventEmitter {
  emit = <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) =>
    super.emit(event, ...args);
  on = <K extends keyof Events>(event: K, listener: Events[K]): this =>
    super.on(event, listener);
}

interface Events {
  speech: (text: string, isLast: boolean) => void;
}
