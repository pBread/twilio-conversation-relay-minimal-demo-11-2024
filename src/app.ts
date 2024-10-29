import dotenv from "dotenv-flow";
import express from "express";
import ExpressWs from "express-ws";
import * as demo from "../demo";
import * as log from "./logger";
import type { CallStatus } from "./twilio-types";

dotenv.config();
const { HOSTNAME, PORT = "3000", RECORD_CALL } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

/****************************************************
 Twilio Voice Webhook Endpoints
****************************************************/
app.post("/incoming-call", async (req, res) => {
  try {
    // reset demo

    // respond with ConversationRelay TwiML
    const { CallSid, From, To } = req.body;
    log.success(`/incoming-call From ${From} To ${To} CallSid ${CallSid}`);

    res.status(200).type("text/xml").end(`\
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
  } catch (err) {
    log.error("/incoming-call webhook error", err);
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
app.ws("/convo-relay/:callSid", (ws, req) => {});

/****************************************************
 Start Server
****************************************************/
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
  console.log(`public base URL https://${HOSTNAME}`);
});
