import {
  ChatSession,
  Content,
  FunctionCall,
  FunctionDeclaration,
  FunctionResponse,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as demo from "../../demo";
import * as fns from "../../demo/functions";
import * as log from "../logger";
import type { AIMessage } from "../state";
import * as state from "../state";
import { LLMEventEmitter } from "./interface";

dotenv.config();

let eventEmitter = new LLMEventEmitter();
export let on = eventEmitter.on;

// only one stream can be open at a time
let controller: AbortController | undefined;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

let functionDeclarations: FunctionDeclaration[] = [];
for (const [name, fn] of Object.entries(fns))
  functionDeclarations.push({
    name: name,
    parameters: fn.parameters,
    description: fn.description,
  });

function translateMessage(msg: state.StoreMessage): Content | undefined {
  let param: Content | undefined;

  // system messages are sent to Gemini via systemInstructions param.
  // currently, the last system message overrides the demo.llm.instructions
  // and all previous system messages
  if (msg.role === "system") return;

  if (msg.role === "ai" && msg.type === "text") {
    param = {
      role: "model",
      parts: [{ text: msg.content }],
    };
  }

  if (msg.role === "ai" && msg.type === "tool") {
    param = {
      role: "model",
      parts: [{ functionCall: JSON.parse(msg.content) as FunctionCall }],
    };
  }

  if (msg.role === "human")
    param = { role: "user", parts: [{ text: msg.content }] };

  if (msg.role === "tool")
    param = {
      role: "model",
      parts: [
        { functionResponse: JSON.parse(msg.content) as FunctionResponse },
      ],
    };

  return param;
}

export async function startRun() {
  let chat: ChatSession;
  // systemInstructions will be overriden by the latest system message
  let systemInstruction: string = demo.llm.instructions;

  let history: Content[] = [];
  const stateMsgs = state.getMessages();
  for (const msg of stateMsgs) {
    if (msg.role === "system") systemInstruction = msg.content;
    const param = translateMessage(msg);
    if (param) history.push(param);
  }

  const message = history.shift();
  if (!message)
    throw Error(`Cannot start run because there are no messages in state`);

  const model = genAI.getGenerativeModel({
    model: demo.llm.model || "gemini-1.5-pro",
    systemInstruction,
  });
  chat = model.startChat({ history: history.reverse() });

  controller = new AbortController();

  let msg: AIMessage | undefined;

  log.debug("history arg", JSON.stringify(history, null, 2));
  try {
    const result = await chat.sendMessageStream(message.parts, {
      signal: controller.signal,
    });
    // Print text as it comes in.
    for await (const chunk of result.stream) {
      const candidate = chunk?.candidates?.[0];
      const text = candidate?.content.parts?.[0]?.text;

      if (text) eventEmitter.emit("speech", text, !!candidate.finishReason); // emit speech to twilio tts

      if (!msg) {
        if (text) msg = state.addAIMessage({ content: text, type: "text" });
        continue;
      }

      if (msg.type === "text" && text) msg.content += text; // append message

      log.debug("chunk", JSON.stringify(chunk, null, 2));
    }
  } catch (error) {
    log.error(`error creating stream`, error);
  }

  controller = undefined;

  log.debug(
    "state messages after",
    JSON.stringify(state.getMessages(), null, 2)
  );
  log.debug(
    "chat message after",
    JSON.stringify(await chat.getHistory(), null, 2)
  );
}

export function abort() {
  controller?.abort();
  controller = undefined;
  return;
}

export function reset() {
  abort();

  eventEmitter = new LLMEventEmitter();
  on = eventEmitter.on;
}
