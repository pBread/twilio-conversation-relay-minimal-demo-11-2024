import dotenv from "dotenv-flow";
import EventEmitter from "events";
import OpenAI from "openai";
import { ChatCompletionChunk } from "openai/resources";
import { Stream } from "openai/streaming";

dotenv.config();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let stream: Stream<ChatCompletionChunk> | undefined; // this demo only supports one call at a time hence there is only one stream open at any time

export function abort() {
  stream?.controller.abort();
  stream = undefined;
}

/****************************************************
 LLM Events
****************************************************/
class LLMEventEmitter extends EventEmitter {
  emit = <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) =>
    super.emit(event, ...args);
  on = <K extends keyof Events>(event: K, listener: Events[K]): this =>
    super.on(event, listener);
}

interface Events {
  speech: (text: string) => void;
}

let eventEmitter: LLMEventEmitter;
export let on: typeof eventEmitter.on;

export function reset() {
  stream = undefined;

  eventEmitter = new LLMEventEmitter();
  on = eventEmitter.on;
}
reset();

/****************************************************
 Handle Completions
****************************************************/
export function startRun() {}
