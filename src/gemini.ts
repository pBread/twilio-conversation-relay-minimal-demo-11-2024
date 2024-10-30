import {
  GenerateContentRequest,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as log from "./logger";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let x: GenerateContentRequest;

export async function startRun() {
  const prompt = "Write a story about a magic backpack.";

  const result = await model.generateContentStream(prompt);

  // Print text as it comes in.
  for await (const chunk of result.stream) {
    log.debug("chunk", JSON.stringify(chunk, null, 2));
    const chunkText = chunk.text();
    process.stdout.write(chunkText);
  }
}
