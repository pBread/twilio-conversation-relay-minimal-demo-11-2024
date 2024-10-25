export const greeting = `Hello, this is Dave with Copart. Is this Roger?`;

/****************************************************
 All of these voices: https://www.twilio.com/docs/voice/twiml/say/text-speech#available-voices-and-languages
 And as of 2024-10-25:
    Google en-US-Journey-D, en-US-Journey-F, en-US-Journey-O, en-IN-Journey-D, en-IN-Journey-F, en-GB-Journey-D, en-GB-Journey-F, de-DE-Journey-D, de-DE-Journey-F
    Amazon Amy-Generative, Matthew-Generative, Ruth-Generative
****************************************************/
export const tts = { voice: "en-US-Journey-D", provider: "google" };
