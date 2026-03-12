import type { Props } from "astro";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconShare from "@/assets/icons/IconShare.svg";
import { SITE } from "@/config/index";

// Social media links (header/footer)
type SocialLink = {
  name: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
  href: string;
};

// Share button types - discriminated union to prevent invalid configurations
type NativeShare = {
  name: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
  isNativeShare: true;
  href?: never;
};

type ExternalShare = {
  name: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
  href: string;
  isNativeShare: false;
};

type ShareLink = NativeShare | ExternalShare;

export const SOCIALS: readonly SocialLink[] = [
  {
    name: "GitHub",
    href: "https://github.com/kyleskrinak",
    linkTitle: `${SITE.title} on GitHub`,
    icon: IconGitHub,
  },
  {
    name: "X",
    href: "https://x.com/screenack",
    linkTitle: `${SITE.title} on X`,
    icon: IconBrandX,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/kyleskrinak/",
    linkTitle: `${SITE.title} on LinkedIn`,
    icon: IconLinkedin,
  },
] as const;

export const SHARE_LINKS: readonly ShareLink[] = [
  {
    name: "Share",
    linkTitle: `Share this post`,
    icon: IconShare,
    isNativeShare: true,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: `Share this post on Facebook`,
    icon: IconFacebook,
    isNativeShare: false,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
    isNativeShare: false,
  },
] as const;
