import type { FunctionDeclarationSchema } from "@google/generative-ai";

export * from "./getCustomerProfile";

export interface ToolFunction {
  (args: {}): Promise<{}>;

  description?: string;
  parameters?: FunctionDeclarationSchema;
}
