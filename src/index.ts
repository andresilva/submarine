import { Logger } from "tslog";
import { ok, err, Result } from "neverthrow";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Event } from "@polkadot/types/interfaces";
import "@polkadot/api-augment/polkadot";

/* eslint-disable */
// @ts-ignore
import safeEval from "safe-eval";
/* eslint-enable */

const log = new Logger();

interface EventParamMatcher {
  readonly index: number;
  readonly value: string;
}

interface EventMatcher {
  readonly name: string;
  readonly params?: EventParamMatcher[];

  match(event: Event): boolean;
}

function newEventMatcher(api: ApiPromise, pattern: string): Result<EventMatcher, Error> {
  const eventRegex = /^(?:api\.events\.)?(\w+.[A-Z]\w+)(?:\((.*)\))?$/;
  const eventParamsValidationRegex = /^(?:[^,\s]+\s*,?\s*)*$/;
  const eventParamsRegex = /(?:([^,\s]+)\s*,?)/g;

  const eventMatch = pattern.match(eventRegex);
  if (!eventMatch) {
    return err(new Error("Invalid event definition."));
  }

  const name = eventMatch[1];
  const rawParams = eventMatch[2];

  const eventTypeEval = Result.fromThrowable(
    (event) => safeEval(event, { api }),
    () => new Error("Invalid event name.")
  );

  const typePredicateResult = eventTypeEval(`api.events.${name}.is`);
  if (typePredicateResult.isErr()) {
    return err(typePredicateResult.error);
  }

  const typePredicate = typePredicateResult.value;

  if (typeof typePredicate !== "function") {
    return err(new Error("Invalid event name."));
  }

  if (!rawParams) {
    return ok({ name, match: typePredicate });
  }

  if (!eventParamsValidationRegex.test(rawParams)) {
    return err(new Error("Invalid event params definition."));
  }

  const eventParamsMatch = rawParams.matchAll(eventParamsRegex);
  if (!eventParamsMatch) {
    return err(new Error("Unreachable: failed to match event params."));
  }

  let index = 0;
  const params: EventParamMatcher[] = [];
  for (const eventParamMatch of eventParamsMatch) {
    const value = eventParamMatch[1];

    if (value !== "_") {
      params.push({ index, value });
    }

    index += 1;
  }

  const paramsPredicate = (event: Event) => {
    params.every((param) => {
      return (
        event.data[param.index].toString() === param.value ||
        event.data[param.index].toHex() === param.value
      );
    });
  };

  const predicate = (event: Event) => {
    return typePredicate(event) && paramsPredicate(event);
  };

  return ok({ name, params, match: predicate });
}

async function main(): Promise<Result<void, Error>> {
  const wsProvider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  const matcher = "api.events.balances.Transfer(_,_,50000000000)";

  const eventMatcherResult = newEventMatcher(api, matcher);
  if (eventMatcherResult.isErr()) {
    return err(eventMatcherResult.error);
  }

  const eventMatcher = eventMatcherResult.value;

  const unsubscribe = await api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;

      if (eventMatcher.match(event)) {
        const eventData = event.data.map((i) => i.toString()).join(", ");
        log.info(`matched: ${event.section}.${event.method}(${eventData})`);
      }
    });
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
