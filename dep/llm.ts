import dotenv from "dotenv-flow";
import EventEmitter from "events";
import OpenAI from "openai";
import type {
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
  speech: (text: string, isLast: boolean) => void;
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

  log.info("new llm completion stream starting");
  stream = await openai.chat.completions.create({
    model: demo.openai.model || "gpt-4-1106-preview",
    messages: state.getMessageParams(), // state messages must be translated to params for openai api
    stream: true,
    ...(demo.openai.tools.length ? { tools: demo.openai.tools } : {}), // openai api throws error if tools is empty array
  });

  let msg: AssistantMessage | undefined;
  let runAgain = false; // triggers a new completion to run after this one completes

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
      eventEmitter.emit(
        "speech",
        choice.delta.content as string,
        !!choice.finish_reason // finish_reason indicates this is last chunk
      );

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

      runAgain = true; // you must run a completion after executing tools
    }
  }

  stream = undefined;
  if (runAgain) startRun();
}

async function executeFn(tool: ChatCompletionMessageToolCall) {
  const fnName = tool.function.name;
  try {
    log.info(
      `tool execution starting: ${fnName}, args: ${tool.function.arguments}`
    );

    if (!(tool.function.name in fns))
      throw Error(`Function not found: ${fnName}`);

    const args = JSON.parse(tool.function.arguments);
    const fn = fns[tool.function.name as keyof typeof fns];

    const data = await fn(args);
    log.success(`tool execution complete: ${fnName}, result: `, data);
    return { ...tool, data };
  } catch (error) {
    log.error(`tool execution error. fn: ${fnName}, tool: `, tool);
    return { ...tool, error };
  }
}

/****************************************************
 Interruptions
****************************************************/
export function abort() {
  stream?.controller.abort();
  stream = undefined;

  // to do: async tools are not currently cancelled. this could lead to incoherent chat history if
  // an async tool returns a value after cancellation.
}

export function interrupt(utteranceUntilInterrupt: string) {
  abort();

  const msgsReversed = state.getMessages().reverse();
  const interruptedMsg = msgsReversed.find(
    (msg) =>
      typeof msg.content === "string" &&
      msg.content?.includes(utteranceUntilInterrupt)
  );

  if (!interruptedMsg)
    return log.warn(
      `Could not find interrupted message. utteranceUntilInterrupt: ${utteranceUntilInterrupt}`
    );

  // redact content of interrupted message
  const curContent = interruptedMsg.content as string;
  const [newContent] = curContent.split(utteranceUntilInterrupt);
  interruptedMsg.content = newContent;

  log.info(
    `msg content redacted to reflect interruption.\nold content: ${curContent}\nnew content: ${newContent}`
  );

  // delete all of the assistant and tool messages created after the interruption
  // if these are not deleted, the bot will think it said things it didn't
  msgsReversed
    .filter((msg) => ["assistant", "tool"].includes(msg.role))
    .filter((msg) => msg.idx > interruptedMsg.idx)
    .forEach((msg) => {
      log.info(`removing ${msg.role} msg (${msg.id}) from local state`);
      state.deleteMsg(msg.id);
    });

  startRun();
}
