import {
  Content,
  FunctionCall,
  FunctionDeclaration,
  FunctionResponse,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as demo from "../demo";
import * as fns from "../demo/functions";
import * as log from "./logger";
import * as state from "./state";

dotenv.config();

// only one stream can be open at a time
let controller: AbortController | undefined;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({
  model: demo.llm.model || "gemini-1.5-flash",
});

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

  if (msg.role === "ai" && msg.type === "content") {
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
  let systemInstruction: string = demo.llm.instructions;

  let history: Content[] = [];
  const stateMsgs = state.getMessages();
  for (const msg of stateMsgs) {
    if (msg.role === "system") systemInstruction = msg.content;
    const param = translateMessage(msg);
    if (param) history.push(param);
  }

  const message = history.pop();
  if (!message)
    throw Error(`Cannot start run because there are no messages in state`);

  const chat = model.startChat({ history, systemInstruction });
  controller = new AbortController();

  const result = await chat.sendMessageStream(message.parts, {
    signal: controller.signal,
  });

  // Print text as it comes in.
  for await (const chunk of result.stream) {
    log.debug("chunk", JSON.stringify(chunk, null, 2));
    const chunkText = chunk.text();
    process.stdout.write(chunkText);
  }

  controller = undefined;
}

export function abort() {
  return controller?.abort();
}
