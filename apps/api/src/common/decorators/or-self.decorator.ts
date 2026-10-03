import { SetMetadata } from "@nestjs/common";

export const OR_SELF_KEY = "orSelf";

export const OrSelf = (param = "id"): MethodDecorator => SetMetadata(OR_SELF_KEY, param);
