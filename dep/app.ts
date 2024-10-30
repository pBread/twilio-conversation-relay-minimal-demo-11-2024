import * as demo from "../demo";
import * as llm from "./llm";
import * as state from "./llm-state";
import * as log from "./logger";
import * as twlo from "./twilio";

/****************************************************
 Conversation Relay Websocket
****************************************************/
app.ws("/convo-relay/:callSid", (ws, req) => {
  // set initial state
  state.createSystemMessage(demo.openai.instructions);
  state.createAssistantMessage("greeting", { content: demo.greeting });

  // send human transcript to LLM
  twlo.onMessage("prompt", (msg) => {
    if (!msg.last) return; // ignore partial speech

    log.success(`human transcript complete:\n${msg.voicePrompt}`);

    state.createUserMessage(msg.voicePrompt); // create the message record before starting the run
    llm.startRun(); // the llm run will execute tools and generate text
  });

  // send bot text to Twilio to be played to the user
  llm.on("speech", (text, isLast) => twlo.textToSpeech(text, isLast));

  twlo.onMessage("interrupt", (msg) => {
    log.info(`human interrupted bot at: ${msg.utteranceUntilInterrupt}`);
    llm.interrupt(msg.utteranceUntilInterrupt);
  });
});
