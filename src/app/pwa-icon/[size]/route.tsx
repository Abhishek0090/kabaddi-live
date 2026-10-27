import { appIcon } from "@/lib/appIcon";

const SIZES = ["192", "512"];

// Built once at build time; any other size is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  return appIcon(Number(size));
}
