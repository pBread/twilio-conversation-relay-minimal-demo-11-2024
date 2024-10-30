declare namespace NodeJS {
  export interface ProcessEnv {
    HOSTNAME: string;
    GEMINI_API_KEY: string;

    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;

    RECORD_CALL?: string; // "true" | "false" | undefined
  }
}
