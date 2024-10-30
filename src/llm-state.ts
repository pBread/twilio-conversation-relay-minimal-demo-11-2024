import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources";
import { cleanObj } from "./util";

let msgMap: Map<number | string, StoreMessage>;
let idx: number = 0;

export function reset() {
  msgMap = new Map();
  idx = 0;
}
reset();

export const getMessages = () => [...msgMap.values()];

/****************************************************
 Entities
****************************************************/
export type StoreMessage =
  | AssistantMessage
  | SystemMessage
  | ToolMessage
  | UserMessage;

interface StoreRecord {
  id: number | string;
  idx: number;
}

// All LLM responses are AssistantMessages
export interface AssistantMessage
  extends StoreRecord,
    ChatCompletionAssistantMessageParam {}

export interface SystemMessage
  extends StoreRecord,
    ChatCompletionSystemMessageParam {}

// ToolMessages are the tool results. Tools are triggered by AssistantMessages w/tool_calls
export interface ToolMessage
  extends StoreRecord,
    ChatCompletionToolMessageParam {}

// UserMessages represent the user's transcript
export interface UserMessage
  extends StoreRecord,
    ChatCompletionUserMessageParam {}

/****************************************************
 Translator
****************************************************/
export function toOpenAiPrompt(msg: StoreMessage) {
  let params = { content: msg.content, role: msg.role };

  if (msg.role === "assistant")
    Object.assign(params, {
      audio: msg.audio,
      name: msg.name,
      refusal: msg.refusal,
      tool_calls: msg.tool_calls,
    });

  if (msg.role === "system") Object.assign(params, { name: msg.name });

  if (msg.role === "tool")
    Object.assign(params, { tool_call_id: msg.tool_call_id });

  if (msg.role === "user") Object.assign(params, { name: msg.name });

  return cleanObj(params) as ChatCompletionMessageParam;
}

/****************************************************
 Record Creators
****************************************************/
export function createAssistantMessage(
  id: string,
  params: Omit<ChatCompletionAssistantMessageParam, "role">
) {
  let msg: AssistantMessage = {
    ...params,
    role: "assistant",
    id,
    idx: idx++,
  };

  msgMap.set(msg.id, msg);
  return msg;
}

export function createSystemMessage(content: string) {
  const id = idx++;
  let msg: SystemMessage = {
    content,
    id,
    idx: id,
    role: "system",
  };

  msgMap.set(msg.id, msg);
  return msg;
}

export function createToolMessage(tool_call_id: string, resultJsonStr: string) {
  const msg: ToolMessage = {
    idx: idx++,
    id: tool_call_id,
    tool_call_id,
    content: resultJsonStr,
    role: "tool",
  };

  msgMap.set(msg.id, msg);
  return msg;
}

export function createUserMessage(content: string) {
  const id = idx++;
  const msg: UserMessage = {
    content,
    id,
    idx: id,
    role: "user",
  };

  msgMap.set(msg.id, msg);
  return msg;
}
