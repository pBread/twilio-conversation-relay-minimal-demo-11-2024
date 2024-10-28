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
import EventEmitter from "events";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/****************************************************
 LLM Events Emitter
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

/****************************************************
 Message Store
****************************************************/
const msgMap = new Map<number | string, StoreMessage>();
let idx = 0; // used as an id

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
}

interface AssistantMessage
  extends ChatCompletionAssistantMessageParam,
    StoreRecord {
  finish_reason?:
    | "tool_calls"
    | "function_call"
    | "length"
    | "stop"
    | "content_filter";
}
function createAssistantMessage(
  id: string,
  payload: ChatCompletionAssistantMessageParam
) {
  let msg = { id, idx: idx++, ...payload };
  msgMap.set(id, msg);
}

interface SystemMessage extends ChatCompletionSystemMessageParam, StoreRecord {}

interface ToolMessage extends ChatCompletionToolMessageParam, StoreRecord {}

interface UserMessage extends ChatCompletionUserMessageParam, StoreRecord {}
export function createUserMessage(content: string) {
  const id = idx++;
  const msg: UserMessage = { id, idx: id, role: "user", content };
  msgMap.set(msg.id, msg);

  return msg;
}

function appendContent(id: number | string, content: string) {
  let msg = msgMap.get(id);
  if (!msg) throw Error(`Attempted to append message that does not exist`);

  msg.content = (msg.content || "") + content;
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
let activeId: null | string;
let stream: null | Stream<ChatCompletionChunk>; // this demo only supports one call at a time hence there is only one stream open at any time

export async function kill() {
  activeId = null;
  stream?.controller.abort();
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

  let role: Roles | undefined;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];

    // is first chunk
    if (!activeId) {
      activeId = chunk.id;
      role = choice.delta.role as Roles;

      if (role === "assistant")
        createAssistantMessage(
          activeId,
          choice.delta as ChatCompletionAssistantMessageParam
        );
      else log.error(`unhandled delta for role ${role}`, choice.delta);
    } else appendContent(activeId, choice.delta.content as string);

    if (role === "assistant" && choice.delta.content)
      eventEmitter.emit("speech", choice.delta.content as string);

    if (role !== "assistant")
      log.debug("stream chunk\n", JSON.stringify(chunk, null, 2));

    if (choice.finish_reason === "stop") {
      log.debug("last chunk!", getAllMessages());
    }
  }

  activeId = null;
  stream = null;
}
