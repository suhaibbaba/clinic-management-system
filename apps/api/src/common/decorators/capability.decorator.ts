import { SetMetadata } from '@nestjs/common';

export const CAPABILITY_KEY = 'capability';

/**
 * Names the permission an endpoint asks for. Optional: the key is otherwise derived from the
 * controller and the handler, so a new endpoint is permissible without anyone maintaining a list.
 * Set it explicitly when the derived name would be wrong, or when renaming a method must not
 * silently create a new permission that every role is then missing.
 */
export const Capability = (key: string): MethodDecorator => SetMetadata(CAPABILITY_KEY, key);
