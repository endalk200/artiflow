import { Data } from "effect";

export class MissingCredential extends Data.TaggedError("MissingCredential")<{
	readonly baseUrl: string;
}> {}

export class CredentialStoreError extends Data.TaggedError("CredentialStoreError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export class DeviceAuthorizationDenied extends Data.TaggedError("DeviceAuthorizationDenied")<Record<never, never>> {}

export class DeviceAuthorizationExpired extends Data.TaggedError("DeviceAuthorizationExpired")<Record<never, never>> {}

export class DeviceAuthorizationInvalid extends Data.TaggedError("DeviceAuthorizationInvalid")<Record<never, never>> {}

export class DeviceAuthorizationNetworkError extends Data.TaggedError("DeviceAuthorizationNetworkError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export class DeviceAuthorizationProtocolError extends Data.TaggedError("DeviceAuthorizationProtocolError")<{
	readonly message: string;
}> {}
