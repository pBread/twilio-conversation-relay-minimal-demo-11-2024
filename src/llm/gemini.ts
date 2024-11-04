import {
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
  // Currently, the last system message overrides the demo.llm.instructions
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
      role: "function",
      parts: [
        { functionResponse: JSON.parse(msg.content) as FunctionResponse },
      ],
    };

  return param;
}

export async function startRun() {
  let runAgain = false;

  const stateMsgs = state.getMessages();

  // systemInstruction use the "instructions" in the demo configuration by default
  // but are overridden by system messages added to the message state. This is
  // because Gemini does not support "system" messages.
  const systemInstruction =
    [...stateMsgs].reverse().find((msg) => msg.role === "system")?.content ??
    demo.llm.instructions;

  const model = genAI.getGenerativeModel({
    systemInstruction: demo.llm.instructions,
    model: demo.llm.model || "gemini-1.5-pro",
    tools: [{ functionDeclarations }],
  });

  let history: Content[] = [];
  for (const msg of stateMsgs) {
    const param = translateMessage(msg);
    if (!param) continue;

    history.push(param);
  }

  log.debug(`raw history`, JSON.stringify(history, null, 2));

  try {
    const result = await model.generateContent({
      contents: history.reverse(),
      systemInstruction,
    });
    log.debug("result 1 ", JSON.stringify(result, null, 2));

    const candidate = result.response.candidates?.[0];

    const fnCall = candidate?.content.parts?.[0]?.functionCall;
    const text = candidate?.content.parts?.[0]?.text;

    if (!fnCall && !text)
      throw Error(
        `Unexpected result from Gemini's API: ${JSON.stringify(result)}`
      );

    // Gemini's model is saying something
    if (text) {
      state.addAIMessage({ content: text, type: "text" });
      eventEmitter.emit("speech", text, !!candidate.finishReason);
    }

    if (fnCall) {
      log.debug("function call start", JSON.stringify(result, null, 2));

      // add the AI's tool execution request to state
      const toolMsg = state.addAIMessage({
        content: JSON.stringify(fnCall),
        type: "tool",
      });

      const fn = fns[fnCall.name as keyof typeof fns];
      if (!fn) log.error(`function not found. name: ${fnCall.name}`);

      const response = await fn(fnCall.args);
      log.info(`fn ${fnCall.name} response`, response);

      state.addToolResultMessage({
        content: JSON.stringify({ name: fnCall.name, response }),
        parentId: toolMsg.id,
      });

      runAgain = true;
    }
  } catch (error) {
    log.error(`error in gemini completion request`, error);
  }

  if (runAgain) return startRun();
}

/****************************************************
 Misc
****************************************************/
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
