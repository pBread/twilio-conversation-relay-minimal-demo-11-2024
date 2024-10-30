import dotenv from "dotenv-flow";
import EventEmitter from "events";
import OpenAI from "openai";
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
} from "openai/resources";
import { Stream } from "openai/streaming";
import * as demo from "../demo";
import type { StoreMessage } from "./llm-state";
import * as state from "./llm-state";
import * as log from "./logger";
import { mutateDeepmergeAppend } from "./util";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

const eventEmitter = new LLMEventEmitter();
export const on = eventEmitter.on;

export function reset() {
  stream = undefined;
}

/****************************************************
 Handle Completions
****************************************************/
export async function startRun() {
  if (stream) log.warn("started llm run but a stream already exists");

  log.info("llm completion stream initializing");
  stream = await openai.chat.completions.create({
    model: demo.openai.model || "gpt-4-1106-preview",
    messages: state.getMessageParams(), // state messages must be translated to params for openai api
    stream: true,
    ...(demo.openai.tools.length ? { tools: demo.openai.tools } : {}), // openai api throws error if tools is empty array
  });
  log.info("llm completion stream initialized");

  let msg: StoreMessage | undefined;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];

    // local msg is set on first chunk
    if (!msg) {
      msg = state.createAssistantMessage(
        chunk.id,
        choice.delta as ChatCompletionAssistantMessageParam
      );
    }
    // merge the chunk into the message
    else mutateDeepmergeAppend(msg, choice.delta);
  }
}
