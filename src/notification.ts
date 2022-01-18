import { ok, err, Result } from "neverthrow";
import fetch from "cross-fetch";
import { NotificationsConfig } from "./config";
import { Event } from "./event-matcher";

export default async function sendNotifications(
  config: NotificationsConfig,
  event: Event
): Promise<Result<void, Error[]>> {
  const errors = [];
  for (const http of config.http) {
    try {
      const response = await fetch(http.url, {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        errors.push(
          new Error(`HTTP notification failed: ${response.status} - ${await response.text()}`)
        );
      }
    } catch (error) {
      errors.push(new Error(`HTTP notification failed: ${(error as Error).message}`));
    }
  }

  if (errors.length === 0) {
    return ok(undefined);
  }

  return err(errors);
}
