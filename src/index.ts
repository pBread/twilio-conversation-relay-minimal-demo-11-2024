import dotenv from "dotenv-flow";
import express from "express";
import ExpressWs from "express-ws";
import * as demo from "../demo";
import type { CallStatus } from "./twilio-types";

dotenv.config();
const { HOSTNAME, PORT = "3000" } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

/****************************************************
 Twilio Voice Webhook Endpoints
****************************************************/
app.post("/incoming-call", async (req, res) => {
  const { CallSid, From, To } = req.body;
  console.log(`/incoming-call from ${From} to ${To}`);

  try {
    res.status(200);
    res.type("text/xml");

    res.end(`
        <Response>
            <Connect>
                <ConversationRelay 
                  url="wss://${HOSTNAME}/ai-relay/${CallSid}"
                  welcomeGreeting="${demo.greeting}"
                  welcomeGreetingInterruptible="true"

                  interruptible="true"

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
  const status = req.body.CallStatus as CallStatus;
  console.log(`/call-status-update ${status}`);

  res.status(200).send();
});

/****************************************************
 Conversation Relay Websocket
****************************************************/
app.ws("/ai-relay/:callSid", (ws) => {
  console.log("incoming websocket");

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    console.log(msg);
  });
});

/****************************************************
 Start Server
****************************************************/
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});
