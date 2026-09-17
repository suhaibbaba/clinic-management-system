export interface TestIdProps {
  /** Names this component's nodes for tests and devtools: the root, and every part suffixed. */
  readonly "data-testid"?: string | undefined;
}

export interface PartAttrs {
  readonly "data-part": string;
  readonly "data-testid"?: string | undefined;
}

/**
 * Names a component's nodes: `data-part` for a product's CSS, `data-testid` for tests and devtools.
 * One id at the call site names the whole subtree — `parts("modal", "payment")("title")` is `payment-title`.
 */
export function parts(root: string, testId: string | undefined): (part?: string) => PartAttrs {
  return (part) => {
    const name = part === undefined ? root : `${root}-${part}`;

    if (testId === undefined) {
      return { "data-part": name };
    }

    return {
      "data-part": name,
      "data-testid": part === undefined ? testId : `${testId}-${part}`,
    };
  };
}

/** The `data-testid` alone, for a node whose `data-part` is fixed by its own contract. */
export function testid(id: string | undefined, part?: string): { "data-testid"?: string } {
  if (id === undefined) {
    return {};
  }

  return { "data-testid": part === undefined ? id : `${id}-${part}` };
}
