export { ARTIFLOW_SERVICE_NAMESPACE } from "@app/telemetry-config";

import webPackage from "./package.json";

export const DEFAULT_WEB_TELEMETRY_SERVICE_NAME = "artiflow-web";
export const WEB_TELEMETRY_SERVICE_VERSION = webPackage.version;
