import {
  GenerateContentRequest,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as log from "./logger";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function startRun() {
  let params: GenerateContentRequest = {
    tools: [
      {
        functionDeclarations: [
          { name: "getProfile", description: "Get user profile" },
        ],
      },
    ],
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
