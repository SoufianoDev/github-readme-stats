import { adaptRequest } from "../../src/common/cloudflare-adapter.js";
import handler from "../../api/wakatime.js";

export const onRequest = (context) => adaptRequest(context, handler);
