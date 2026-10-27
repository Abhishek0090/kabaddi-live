import { ImageResponse } from "next/og";

/**
 * App icon as a PNG. The mark fills 62% of the square, inside the 80% safe
 * zone, so the same image works as a maskable icon.
 */
export function appIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: size * 0.62,
            height: size * 0.62,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: size * 0.16,
            background: "#ea580c",
            color: "#ffffff",
            fontSize: size * 0.44,
            fontWeight: 900,
          }}
        >
          K
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
