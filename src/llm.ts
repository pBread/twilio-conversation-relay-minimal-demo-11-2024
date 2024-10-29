import dotenv from "dotenv-flow";
import EventEmitter from "events";
import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources";
import type { Stream } from "openai/streaming";
import * as demo from "../demo";
import * as log from "./logger";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/****************************************************
 LLM Events Emitter
****************************************************/
class LLMEventEmitter extends EventEmitter {
  emit = <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) =>
    super.emit(event, ...args);
  on = <K extends keyof Events>(event: K, listener: Events[K]): this =>
    super.on(event, listener);

  static reset = () => {
    eventEmitter = new LLMEventEmitter();
    on = eventEmitter.on;
  };
}

interface Events {
  speech: (text: string) => void;
}

let eventEmitter = new LLMEventEmitter();
export let on = eventEmitter.on;

function resetEventEmitter() {
  eventEmitter = new LLMEventEmitter();
  on = eventEmitter.on;
}

/****************************************************
 Message Store
****************************************************/
let msgMap = new Map<number | string, StoreMessage>();
let idx = 0; // used as an id

function resetStore() {
  msgMap = new Map<number | string, StoreMessage>();
  idx = 0;
}

export type StoreMessage =
  | AssistantMessage
  | SystemMessage
  | ToolMessage
  | UserMessage;

type ExtractMessageRoles<T> = T extends { role: infer U } ? U : never;
type Roles = ExtractMessageRoles<StoreMessage>;

// properties shared with all message types
interface StoreRecord {
  id: number | string;
  idx: number;
  status: MessageStatus;
}

type MessageStatus = "active" | "finished" | "interrupted";

interface AssistantMessage
  extends ChatCompletionAssistantMessageParam,
    StoreRecord {
  finish_reason:
    | "tool_calls"
    | "function_call"
    | "length"
    | "stop"
    | "content_filter"
    | null;
}

export function createAssistantMessage(
  id: string,
  payload: Omit<ChatCompletionAssistantMessageParam, "role">,
  status: MessageStatus = "active"
) {
  let msg: AssistantMessage = {
    finish_reason: null,
    status,
    ...payload,
    role: "assistant",
    id,
    idx: idx++,
  };

  msgMap.set(msg.id, msg);
  return msg;
}

interface SystemMessage extends ChatCompletionSystemMessageParam, StoreRecord {}
export function createSystemMessage(content: string) {
  const id = idx++;
  let msg: SystemMessage = {
    content,
    id,
    idx: id,
    role: "system",
    status: "finished",
  };

  msgMap.set(msg.id, msg);
  return msg;
}

// these messages are created after the tool call is complete.
// tool execution requests are assistant messages
interface ToolMessage extends ChatCompletionToolMessageParam, StoreRecord {}

interface UserMessage extends ChatCompletionUserMessageParam, StoreRecord {}
export function createUserMessage(content: string) {
  const id = idx++;
  const msg: UserMessage = {
    content,
    id,
    idx: id,
    role: "user",
    status: "finished", // user messages are only created after they are done speaking
  };

  msgMap.set(msg.id, msg);
  return msg;
}

export const getAllMessages = () => [...msgMap.values()];

/** translates store message to the format OpenAI expects  */
function toParam(msg: StoreMessage) {
  let param = { content: msg.content, role: msg.role };

  if (msg.role === "assistant")
    Object.assign(
      param,
      cleanObj({
        audio: msg.audio,
        name: msg.name,
        refusal: msg.refusal,
        tool_calls: msg.tool_calls,
      })
    );

  if (msg.role === "system") Object.assign(param, cleanObj({ name: msg.name }));

  if (msg.role === "tool")
    Object.assign(param, cleanObj({ tool_call_id: msg.tool_call_id }));

  if (msg.role === "user") Object.assign(param, cleanObj({ name: msg.name }));

  return param as ChatCompletionMessageParam;
}

function cleanObj(obj: { [key: string]: any }) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

/****************************************************
 Chat Completion Handling
****************************************************/
let stream: null | Stream<ChatCompletionChunk>; // this demo only supports one call at a time hence there is only one stream open at any time

export function abort() {
  stream?.controller.abort();
}

export function interrupt(utteranceUntilInterrupt: string) {
  log.debug("interrupt", getAllMessages());
  const msgs = getAllMessages().reverse();

  const lastAssistantMessage = msgs.find((msg) => msg.role === "assistant");
  if (lastAssistantMessage) {
    lastAssistantMessage.status = "interrupted";
    const curContent = lastAssistantMessage.content as string;
    const [newContent] = curContent.split(utteranceUntilInterrupt);
    lastAssistantMessage.content = newContent;
  }
}

export async function doCompletion() {
  if (stream) log.warn("doCompletion called when stream exists");

  log.debug("stream initializing");

  stream = await client.chat.completions.create({
    model: demo.openai.model || "gpt-4-1106-preview",
    messages: getAllMessages().map(toParam),
    stream: true,
    ...(demo.openai.tools.length ? { tools: demo.openai.tools } : {}), // openai api throws error if tools is empty array
  });

  log.debug("stream initialized");

  let msg: StoreMessage | undefined;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    log.debug("chunks", JSON.stringify(chunk, null, 2));

    if (!msg) {
      const role = choice.delta.role as Roles;

      if (role === "assistant")
        msg = createAssistantMessage(
          chunk.id,
          choice.delta as ChatCompletionAssistantMessageParam
        );
      else log.error(`unhandled delta for role ${role}`, choice.delta);
    } else mutateAppend(msg, choice.delta);

    if (!msg) throw Error("Store message not found.");

    switch (msg.role) {
      case "assistant":
        msg.finish_reason = choice.finish_reason;
        if (msg.finish_reason) msg.status = "finished";
    }

    if (msg.role === "assistant" && choice.delta.content)
      eventEmitter.emit("speech", choice.delta.content as string);

    if (msg.role !== "assistant")
      log.debug("stream chunk\n", JSON.stringify(chunk, null, 2));

    if (choice.finish_reason === "tool_calls") {
    }

    if (choice.finish_reason === "stop") {
      log.debug("last chunk!");
    }
  }

  stream = null;
}

/****************************************************
 Misc
****************************************************/
export function reset() {
  resetEventEmitter();
  resetStore();
  abort();
}

function mutateAppend<
  T extends Record<string, any>,
  U extends Record<string, any>
>(obj1: T, obj2: U): T & U {
  for (const key in obj2) {
    if (typeof obj2[key] === "string" && typeof obj1[key] === "string") {
      // Append if both values are strings
      (obj1[key] as string) += obj2[key];
    } else if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
      // Handle arrays by merging objects within based on index
      obj1[key] = obj2[key].map((item: any, index: number) => {
        if (
          typeof item === "object" &&
          !Array.isArray(item) &&
          obj1[key][index]
        ) {
          // Mutate the object at the same index
          return mutateAppend(obj1[key][index], item);
        }
        return item;
      }) as any;
    } else {
      // Otherwise, directly assign the value from obj2 to obj1, with assertion
      (obj1 as any)[key] = obj2[key];
    }
  }

  return obj1 as T & U;
}
