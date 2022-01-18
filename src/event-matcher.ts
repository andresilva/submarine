import { ok, err, Result } from "neverthrow";
/* eslint-disable */
// @ts-ignore
import safeEval from "safe-eval";
/* eslint-enable */

import { ApiPromise } from "@polkadot/api";
import { Event as PolkadotEvent } from "@polkadot/types/interfaces";

export interface Event {
  readonly name: string;
  readonly params: string[];
}

export interface EventParamMatcher {
  readonly index: number;
  readonly value: string;
}

export interface EventMatcher {
  readonly name: string;
  readonly params?: EventParamMatcher[];

  match(event: PolkadotEvent): Event | undefined;
}

export function newEventMatcher(api: ApiPromise, pattern: string): Result<EventMatcher, Error> {
  const eventRegex = /^(?:api\.events\.)?(\w+.[A-Z]\w+)(?:\((.*)\))?$/;
  const eventParamsValidationRegex = /^(?:[^,\s]+\s*,?\s*)*$/;
  const eventParamsRegex = /(?:([^,\s]+)\s*,?)/g;

  const eventMatch = pattern.match(eventRegex);
  if (!eventMatch) {
    return err(new Error(`Invalid event definition: ${pattern}`));
  }

  const name = eventMatch[1];
  const rawParams = eventMatch[2];

  const eventTypeEval = Result.fromThrowable(
    (event) => safeEval(event, { api }),
    () => new Error(`Invalid event name: ${name}`)
  );

  const typePredicateResult = eventTypeEval(`api.events.${name}.is`);
  if (typePredicateResult.isErr()) {
    return err(typePredicateResult.error);
  }

  const typePredicate = typePredicateResult.value;

  if (typeof typePredicate !== "function") {
    return err(new Error(`Invalid event name: ${name}`));
  }

  const eventFromPolkadotEvent = (event: PolkadotEvent) => {
    const params = event.data.map((i) => i.toString());
    return {
      name: `${event.section}.${event.method}`,
      params
    };
  };

  if (!rawParams) {
    return ok({
      name,
      match: (event) => {
        if (typePredicate(event)) {
          return eventFromPolkadotEvent(event);
        }
        return undefined;
      }
    });
  }

  if (!eventParamsValidationRegex.test(rawParams)) {
    return err(new Error(`Invalid event params definition: ${rawParams}`));
  }

  const eventParamsMatch = rawParams.matchAll(eventParamsRegex);
  if (!eventParamsMatch) {
    return err(new Error("Unreachable: failed to match event params"));
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

  const paramsPredicate = (event: PolkadotEvent) => {
    return (
      params.length === 0 ||
      params.every((param) => {
        return (
          event.data[param.index].toString() === param.value ||
          event.data[param.index].toHex() === param.value
        );
      })
    );
  };

  const predicate = (event: PolkadotEvent) => {
    if (typePredicate(event) && paramsPredicate(event)) {
      return eventFromPolkadotEvent(event);
    }
    return undefined;
  };

  return ok({ name, params, match: predicate });
}
