import convict from "convict";
import { url as urlFormat } from "convict-format-with-validator";
import toml from "toml";

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

const config = convict({
  events: {
    format: "source-array",
    default: [],
    children: {
      matcher: {
        format: "*",
        default: null
      }
    }
  }
});

config.loadFile("./config.toml");
config.validate({ allowed: "strict" });

export default config;
