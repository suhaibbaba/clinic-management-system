import { SetMetadata } from '@nestjs/common';

export const CAPABILITY_KEY = 'capability';

export const Capability = (key: string): MethodDecorator => SetMetadata(CAPABILITY_KEY, key);
