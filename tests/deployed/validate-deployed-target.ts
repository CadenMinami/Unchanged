import { resolveDeployedBaseUrl } from "../../playwright.deployed.config";

export default function validateDeployedTarget(): void {
  resolveDeployedBaseUrl({
    HISTORY_UNBROKEN_DEPLOYED_URL: process.env.HISTORY_UNBROKEN_DEPLOYED_URL,
  });
}
