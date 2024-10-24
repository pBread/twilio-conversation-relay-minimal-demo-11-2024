/****************************************************
 Twilio Conversation Relay Actions
****************************************************/
export type TwilioAction = Clear | SendAudio | SendMark;

type Clear = {
  event: "clear";
  streamSid: string;
};

type SendAudio = {
  event: "media";
  streamSid: string;
  media: { payload: string };
};

type SendMark = {
  event: "mark";
  streamSid: string;
  mark: { name: string };
};

/****************************************************
 Twilio Conversation Relay Messages
****************************************************/
export type TwilioRelayMessage = PromptComplete | SetupMessage;

type ExtractMessageEvent<T> = T extends { event: infer U } ? U : never;
export type TwilioRelayMessageTypes = ExtractMessageEvent<TwilioRelayMessage>;

type PromptComplete = {
  type: "prompt";
  voicePrompt: string;
  lang: "en-US";
  last: true;
};

type SetupMessage = {
  accountSid: string;
  applicationSid: string | null;
  callerName: string;
  callSid: string;
  callStatus: string;
  callType: "PSTN";
  direction: "inbound";
  forwardedFrom: string;
  from: string;
  parentCallSid: string;
  sessionId: string;
  to: string;
  type: "setup";
};

/****************************************************
 Misc Twilio
****************************************************/
export type CallStatus = "completed" | "initializing" | "started" | "error";
