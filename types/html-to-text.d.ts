declare module "html-to-text" {
  export function htmlToText(
    html: string,
    options?: {
      wordwrap?: number;
      selectors?: { selector: string; format: "skip" }[];
    }
  ): string;
}
