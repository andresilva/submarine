import { ok, err, Result } from "neverthrow";
import { Logger } from "tslog";

import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/polkadot";

import { EventMatcher, newEventMatcher } from "./event-matcher";
import { createClients, sendNotifications } from "./notification";
import loadConfig from "./config";

const log = new Logger();

async function main(): Promise<Result<void, Error>> {
  let configFile = process.argv[2];
  if (!configFile || configFile.startsWith("--")) {
    configFile = "config.toml";
  }

  const configResult = loadConfig(configFile);
  if (configResult.isErr()) {
    return err(configResult.error);
  }
  const config = configResult.value;

  const wsProvider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  const eventMatchers: EventMatcher[] = [];
  for (const event of config.events) {
    const eventMatcherResult = newEventMatcher(api, event.matcher);
    if (eventMatcherResult.isErr()) {
      return err(eventMatcherResult.error);
    }

    eventMatchers.push(eventMatcherResult.value);
  }

  log.debug("event matchers: ", eventMatchers);

  const notificationClientsResult = await createClients(config.services);
  if (notificationClientsResult.isErr()) {
    return err(notificationClientsResult.error);
  }
  const notificationClients = notificationClientsResult.value;

  if (!notificationClients.twilio && config.notifications.sms.length !== 0) {
    log.warn("SMS notifications are enabled but Twilio service is not configured.");
  }

  if (!notificationClients.smtp && config.notifications.email.length !== 0) {
    log.warn("Email notifications are enabled but SMTP service is not configured.");
  }

  const unsubscribe = await api.query.system.events(async (events) => {
    const notifications = [];

    for (const record of events) {
      const polkadotEvent = record.event;

      for (const eventMatcher of eventMatchers) {
        const event = eventMatcher.match(polkadotEvent);
        if (event) {
          log.info(`event: ${event.name}(${event.params.join(", ")})`);

          notifications.push(sendNotifications(notificationClients, config.notifications, event));
        }
      }
    }

    const results = await Promise.all(notifications);
    for (const result of results) {
      if (result.isErr()) {
        for (const error of result.error) {
          log.error(error);
        }
      }
    }
  });

  process.on("SIGINT", () => {
    unsubscribe();
    process.exit();
  });

  return ok(undefined);
}

main()
  .then((result) => {
    if (result.isErr()) {
      log.error(result.error);
      process.exit(-1);
    }
  })
  .catch((error) => {
    log.error(error);
    process.exit(-1);
  });
