import dotenv from "dotenv-flow";
import EventEmitter from "events";
import OpenAI from "openai";
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageToolCall,
} from "openai/resources";
import { Stream } from "openai/streaming";
import * as demo from "../demo";
import * as fns from "../demo/functions";
import type { AssistantMessage } from "./llm-state";
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

  let msg: AssistantMessage | undefined;

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

    if (choice.delta.content)
      eventEmitter.emit("speech", choice.delta.content as string);

    if (choice.finish_reason === "content_filter")
      log.error(`completion failed due to content_filter`);

    if (choice.finish_reason === "length") {
      log.warn(
        `Llm completion stopped due to length. It's being restarted but you should update your prompt to get shorter content`
      );
      startRun();
    }

    if (choice.finish_reason === "stop")
      log.info(`llm chat completion run complete`);

    if (choice.finish_reason === "tool_calls") {
      if (!msg.tool_calls?.length) {
        log.error(
          `assistant attempted to initate tool calls but not tool calls were defined`,
          JSON.stringify(msg)
        );
        break;
      }

      const results = await Promise.all(msg.tool_calls.map(executeFn));

      for (const result of results) {
        // todo: add error handling
        if ("error" in result) continue;
        state.createToolMessage(result.id, JSON.stringify(result.data));
      }
      log.info(`tool calling complete`);

      startRun();
    }
  }

  stream = undefined;
}

async function executeFn(tool: ChatCompletionMessageToolCall) {
  const fnName = tool.function.name;
  try {
    log.info(
      `tool execution starting. fn: ${fnName} args: ${tool.function.arguments}`
    );

    if (!(tool.function.name in fns))
      throw Error(`Function not found: ${fnName}`);

    const args = JSON.parse(tool.function.arguments);
    const fn = fns[tool.function.name as keyof typeof fns];

    const data = await fn(args);
    log.success(`tool execution complete: fn: ${fnName}`);
    return { ...tool, data };
  } catch (error) {
    log.error(`tool execution error. fn: ${fnName}, tool: `, tool);
    return { ...tool, error };
  }
}
