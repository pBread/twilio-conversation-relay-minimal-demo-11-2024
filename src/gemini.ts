import {
  FunctionDeclaration,
  FunctionDeclarationSchema,
  GenerateContentRequest,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as demo from "../demo";
import * as log from "./logger";
import * as fns from "../demo/functions";

dotenv.config();

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

export async function startRun() {
  let params: GenerateContentRequest = {
    tools: [{ functionDeclarations }],
    contents: [{ role: "user", parts: [{ text: "What is my " }] }],
  };

  const result = await model.generateContentStream(params);

  // Print text as it comes in.
  for await (const chunk of result.stream) {
    log.debug("chunk", JSON.stringify(chunk, null, 2));
    const chunkText = chunk.text();
    process.stdout.write(chunkText);
  }
}
