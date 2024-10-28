import dotenv from "dotenv-flow";
import express from "express";
import ExpressWs from "express-ws";
import * as demo from "../demo";
import * as llm from "./llm";
import * as log from "./logger";
import * as twlo from "./twilio";
import type { CallStatus } from "./twilio-types";

dotenv.config();
const { HOSTNAME, PORT = "3000", RECORD_CALL } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

/****************************************************
 Twilio Voice Webhook Endpoints
****************************************************/
app.post("/incoming-call", async (req, res) => {
  const { CallSid, From, To } = req.body;
  log.reset();
  llm.reset();

  log.success(`/incoming-call From ${From} To ${To} CallSid ${CallSid}`);

  try {
    res.status(200);
    res.type("text/xml");

    res.end(`
        <Response>
            <Connect>
                <ConversationRelay 
                  url="wss://${HOSTNAME}/convo-relay/${CallSid}"
                  welcomeGreeting="${demo.greeting}"
                  welcomeGreetingInterruptible="true"

                  voice="${demo.tts.voice}"
                  ttsProvider="${demo.tts.provider}"
                />
            </Connect>
        </Response>
          `);
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

app.post("/call-status-update", async (req, res) => {
  const callSid = req.body.CallSid;
  const status = req.body.CallStatus as CallStatus;
  const msg = `/call-status-update ${status} CallSid ${callSid}`;

  if (status === "error") log.error(msg);
  else log.info(msg);

  log.debug(`llm message history`, llm.getAllMessages());

  res.status(200).send();
});

/****************************************************
 Conversation Relay Websocket
****************************************************/
app.ws("/convo-relay/:callSid", (ws, req) => {
  // initialization
  log.info("/convo-relay websocket initializing");
  twlo.setCallSid(req.params.callSid);
  twlo.setWs(ws);

  twlo.onMessage("setup", (msg) => {
    log.success(`/convo-relay websocket initialized`);
    if (RECORD_CALL?.toLowerCase() === "true") twlo.startCallRecording();
  });

  // send LLM generated speech to Twilio TTS
  llm.on("speech", (text) => twlo.textToSpeech(text));

  // send human speech to LLM
  twlo.onMessage("prompt", (msg) => {
    if (!msg.last) return; // partial speech

    log.info(`human speech complete \n${msg.voicePrompt}`);

    llm.createUserMessage(msg.voicePrompt); // creates a message record in memory
    llm.doCompletion(); // initiates the completion loop
  });

  // handle user interrupting LLM speech
  twlo.onMessage("interrupt", (msg) => {
    log.info(`human interruption`);

    log.debug("/convo-relay interrupt", msg);

    llm.abort(); // abort all open requests
  });

  twlo.onMessage("dtmf", (msg) => log.debug("dtmf", msg));
});

/****************************************************
 Start Server
****************************************************/
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
  console.log(`expected public base URL https://${HOSTNAME}`);
});
