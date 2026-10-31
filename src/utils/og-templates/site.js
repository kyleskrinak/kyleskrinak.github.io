import satori from "satori";
import { SITE, OG_IMAGE_SIZE } from "@/config";
import loadFonts from "../loadFonts";
import loadFaviconBadge from "../loadFaviconBadge";

const AVATAR_SIZE = 320;
// loadFaviconBadge() keys the avatar's white sticker border out to
// transparent. On the navy card that leaves its thin outer outline floating
// off the head, so the avatar sits on a light disc that restores the sticker.
const DISC_SIZE = 380;

// The site's dark theme (src/styles/global.css). Satori can't read CSS
// variables, so the values are repeated here.
const BACKGROUND = "#212737";
const FOREGROUND = "#eaedf3";
const ACCENT = "#ff6b01";

export default async () => {
  const avatarDataUri = await loadFaviconBadge(AVATAR_SIZE);

  return satori(
    {
      type: "div",
      props: {
        style: {
          background: BACKGROUND,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 72px",
          boxSizing: "border-box",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: `${DISC_SIZE}px`,
                height: `${DISC_SIZE}px`,
                borderRadius: "50%",
                border: `8px solid ${ACCENT}`,
                background: FOREGROUND,
                boxSizing: "border-box",
                flexShrink: 0,
              },
              children: {
                type: "img",
                props: {
                  src: avatarDataUri,
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                },
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                marginLeft: "56px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 76,
                      fontWeight: "bold",
                      color: FOREGROUND,
                      lineHeight: 1.1,
                    },
                    children: SITE.author,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      width: "96px",
                      height: "8px",
                      background: ACCENT,
                      margin: "28px 0",
                    },
                  },
                },
                {
                  type: "div",
                  props: {
                    style: { fontSize: 42, color: FOREGROUND, lineHeight: 1.35 },
                    // Non-breaking hyphens keep each hyphenated word on one line.
                    children: SITE.desc.replaceAll("-", "\u2011"),
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 40,
                      fontWeight: "bold",
                      color: ACCENT,
                      marginTop: "36px",
                    },
                    children: new URL(SITE.website).hostname,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      embedFont: true,
      fonts: await loadFonts(),
    }
  );
};
