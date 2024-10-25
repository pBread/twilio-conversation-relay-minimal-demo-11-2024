import twilio from "twilio";
import type { WebSocket } from "ws";
import { TwilioRelayMessage, TwilioRelayMessageTypes } from "./twilio-types";

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export let ws: WebSocket; // media stream websocket
export const setWs = (wss: WebSocket) => (ws = wss);

let callSid: string;
export const setCallSid = (sid: string) => (callSid = sid);

let streamSid: string;
export const setStreamSid = (sid: string) => (streamSid = sid);

/****************************************************
 Conversation Relay Actions
****************************************************/
export function endSession(handoffData: {}) {
  ws.send(
    JSON.stringify({ type: "end", handoffData: JSON.stringify(handoffData) })
  );
}

export function sendToken(token: string, last: boolean = false) {
  ws.send(JSON.stringify({ type: "text", token, last }));
}
/****************************************************
 Conversation Relay Message Listener
****************************************************/
export function onMessage<T extends TwilioRelayMessageTypes>(
  type: T,
  callback: (message: TwilioRelayMessage & { type: T }) => void
) {
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as TwilioRelayMessage;
    if (msg.type === type) callback(msg as TwilioRelayMessage & { type: T });
  });
}

/****************************************************
 Call Actions
****************************************************/
export async function startCallRecording() {
  return client.calls(callSid).recordings.create({
    recordingStatusCallback: `https://${process.env.HOSTNAME}/recording-status`,
    recordingStatusCallbackMethod: `POST`,
  });
}
