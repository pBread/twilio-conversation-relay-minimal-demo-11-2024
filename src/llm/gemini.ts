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

dotenv.config();

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
  // systemInstructions will be overriden by the latest system message
  let systemInstruction: string = demo.llm.instructions;

  let history: Content[] = [];
  const stateMsgs = state.getMessages();
  for (const msg of stateMsgs) {
    if (msg.role === "system") systemInstruction = msg.content;
    const param = translateMessage(msg);
    if (param) history.push(param);
  }

  const message = history[0];
  if (!message)
    throw Error(`Cannot start run because there are no messages in state`);

  const model = genAI.getGenerativeModel({
    model: demo.llm.model || "gemini-1.5-flash",
    systemInstruction,
  });
  const chat = model.startChat({ history: history.reverse() });

  controller = new AbortController();

  try {
    const result = await chat.sendMessageStream(
      message.parts[0].text as string,
      { signal: controller.signal }
    );
    // Print text as it comes in.
    for await (const chunk of result.stream) {
      log.debug("chunk", JSON.stringify(chunk, null, 2));
      const chunkText = chunk.text();
      process.stdout.write(chunkText);
    }
  } catch (error) {
    log.error(`error creating stream`, error);
    //@ts-ignore
    log.error(`errorDetails`, JSON.stringify(error?.errorDetails, null, 2));
  }

  controller = undefined;
}

export function abort() {
  controller?.abort();
  controller = undefined;
  return;
}

export function reset() {
  abort();
}
