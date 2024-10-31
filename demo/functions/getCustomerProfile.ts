import type { SchemaType } from "@google/generative-ai";
import type { ToolFunction } from "./index";

export const getCustomerProfile: ToolFunction = async ({}) => ({
  name: "Roger",
});

getCustomerProfile.description = "Fetches the callers profile";
getCustomerProfile.parameters = {
  type: "object" as SchemaType,
  properties: {},
};
