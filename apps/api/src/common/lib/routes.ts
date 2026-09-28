import { RequestMethod } from "@nestjs/common";

export const joinPath = (...segments: string[]): string =>
  `/${segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .join("/")}`;

export const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.DELETE]: "DELETE",
  [RequestMethod.PATCH]: "PATCH",
};
