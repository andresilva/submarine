import convict from "convict";
import { email as emailFormat, url as urlFormat } from "convict-format-with-validator";
import { ok, err, Result } from "neverthrow";
import toml from "toml";

convict.addFormat(emailFormat);
convict.addFormat(urlFormat);
convict.addFormat({
  name: "source-array",
  validate: (sources, schema) => {
    if (!Array.isArray(sources)) {
      /* eslint-disable */
      throw new Error("must be of type Array");
      /* eslint-enable */
    }

    for (const source of sources) {
      convict(schema.children).load(source).validate();
    }
  }
});
convict.addParser({ extension: "toml", parse: toml.parse });

const schema = {
  notifications: {
    http: {
      format: "source-array",
      default: [],
      children: {
        url: {
          format: "url",
          default: null
        }
      }
    }
  },
  events: {
    format: "source-array",
    default: [],
    children: {
      matcher: {
        format: String,
        default: null
      }
    }
  }
};

export type HttpNotificationConfig = {
  url: string;
};

export type NotificationsConfig = {
  http: HttpNotificationConfig[];
};

export type EventConfig = {
  matcher: string;
};

export type Config = {
  events: EventConfig[];
  notifications: NotificationsConfig;
};

export default function loadConfig(filePath: string): Result<Config, Error> {
  const config = convict(schema);

  /* eslint-disable */
  try {
    config.loadFile(filePath);
  } catch {
    return err(new Error(`Invalid config file: ${filePath}`));
  }

  try {
    config.validate({ allowed: "strict" });
  } catch (error) {
    return err(new Error(`Config validation failed: ${(error as Error).message}`));
  }
  /* eslint-enable */

  return ok(config.getProperties());
}
