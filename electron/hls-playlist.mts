export type Mint = (target: {
  url: string;
  provider: string | null;
  referer: string;
  origin: string;
}) => string | null;

export type Rewrite = {
  mint: Mint;
  provider: string | null;
  referer?: string;
  origin?: string;
  tokenSuffix?: string;
};

export function transformPlaylist(
  content: string,
  baseUrl: string,
  proxyBaseUrl: string,
  options: Rewrite,
): string {
  const { mint, provider, referer = "", origin = "", tokenSuffix = "" } = options;

  const proxify = (uri: string): string => {
    let absolute: string;
    try {
      absolute = new URL(uri, baseUrl).toString();
    } catch {
      return uri;
    }
    if (!/^https?:\/\//i.test(absolute)) return uri;

    const handle = mint({ url: absolute, provider, referer, origin });
    return handle ? `${proxyBaseUrl}?h=${handle}${tokenSuffix}` : uri;
  };

  return content
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return line;
      // Audio and subtitle tracks, aes keys and init segments come as a URI attribute.
      if (line.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxify(uri)}"`);
      }
      return proxify(line.trim());
    })
    .join("\n");
}
