declare module "cookie" {
  export interface SerializeOptions {
    [key: string]: unknown;
  }

  export function parse(
    str: string,
    options?: Record<string, unknown>
  ): Record<string, string>;

  export function serialize(
    name: string,
    value: string,
    options?: SerializeOptions
  ): string;
}
