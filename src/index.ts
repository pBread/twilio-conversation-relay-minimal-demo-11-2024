import dotenv from "dotenv-flow";
import express from "express";
import ExpressWs from "express-ws";
import * as demo from "../demo";
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
  log.success(`/incoming-call From ${From} To ${To} CallSid ${CallSid}`);

  try {
    res.status(200);
    res.type("text/xml");

    res.end(`
        <Response>
            <Connect>
                <ConversationRelay 
                  url="wss://${HOSTNAME}/convo-relay"
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

  res.status(200).send();
});

/****************************************************
 Conversation Relay Websocket
****************************************************/
app.ws("/convo-relay", (ws, req) => {
  log.success("/convo-relay websocket established");

  twlo.setWs(ws);

  twlo.onMessage("setup", (msg) => {
    log.debug("/convo-relay setup", msg);

    twlo.setCallSid(msg.callSid);
    if (RECORD_CALL?.toLowerCase() === "true") twlo.startCallRecording();
  });

  twlo.onMessage("prompt", (msg) => {
    log.debug("/convo-relay prompt", msg);
  });

  twlo.onMessage("interrupt", (msg) => {
    log.debug("/convo-relay interrupt", msg);
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
