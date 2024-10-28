import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources";
import * as demo from "../demo";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/****************************************************
 Message Store
****************************************************/
const msgMap = new Map<string, StoreMessage>();

export type StoreMessage =
  | AssistantMessage
  | SystemMessage
  | ToolMessage
  | UserMessage;

interface AssistantMessage extends ChatCompletionAssistantMessageParam {}
interface SystemMessage extends ChatCompletionSystemMessageParam {}
interface ToolMessage extends ChatCompletionToolMessageParam {}
interface UserMessage extends ChatCompletionUserMessageParam {}

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
 Methods
****************************************************/
export async function startCompletion() {
  client.chat.completions.create({
    model: demo.openai.model || "gpt-4-1106-preview",
    messages: getAllMessages().map(toParam),
    tools: demo.openai.tools,
    stream: true,
  });
}
