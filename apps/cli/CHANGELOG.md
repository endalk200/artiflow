# artiflow

## 0.3.0

### Minor Changes

- 0da0637: Allow CLI telemetry to be enabled or disabled in the Artiflow config file and identify the bounded command in root span names.

## 0.2.1

### Patch Changes

- 33c28dc: Add OpenTelemetry traces and structured logs for CLI commands, with configurable OTLP/HTTP export, bounded shutdown, stable command attributes, and end-to-end trace propagation into Artiflow web requests.

## 0.2.0

### Minor Changes

- 9961537: Remove the `artiflow skill install` command and distribute the Artiflow Skill through the Skills CLI. Install it with `npx skills add https://github.com/endalk200/artiflow` instead.

## 0.1.0

### Minor Changes

- 44db7c9: Add Project linking, Artifact publication and revision management, Artifact browsing, and Artiflow Skill installation. Replace the former configuration commands with file- and environment-based server URL configuration.

## 0.0.1

### Patch Changes

- Add the initial Artiflow CLI with configuration management, version reporting,
  opt-in OTLP telemetry, and a bundled Node.js executable.
