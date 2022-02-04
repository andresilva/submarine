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
      throw new Error("must be of type Array");
    }

    for (const source of sources) {
      convict(schema.children).load(source).validate();
    }
  }
});
convict.addParser({ extension: "toml", parse: toml.parse });

const schema = {
  services: {
    twilio: {
      account_sid: {
        format: String,
        default: ""
      },
      auth_token: {
        format: String,
        default: ""
      },
      from_number: {
        format: String,
        default: ""
      }
    }
  },
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
    },
    sms: {
      format: "source-array",
      default: [],
      children: {
        number: {
          format: String,
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

export type TwilioConfig = {
  account_sid: string;
  auth_token: string;
  from_number: string;
};

export type ServiceConfig = {
  twilio: TwilioConfig;
};

export type SmsNotificationConfig = {
  number: string;
};

export type HttpNotificationConfig = {
  url: string;
};

export type NotificationsConfig = {
  http: HttpNotificationConfig[];
  sms: SmsNotificationConfig[];
};

export type EventConfig = {
  matcher: string;
};

export type Config = {
  services: ServiceConfig;
  events: EventConfig[];
  notifications: NotificationsConfig;
};

export default function loadConfig(filePath: string): Result<Config, Error> {
  const config = convict(schema);

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

  return ok(config.getProperties());
}
