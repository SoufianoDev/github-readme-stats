import { adaptRequest } from "../../../src/common/cloudflare-adapter.js";
import handler from "../../../api/status/up.js";

export const onRequest = (context) => adaptRequest(context, handler);
