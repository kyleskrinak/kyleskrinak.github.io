import type { Props } from "astro";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconSubstack from "@/assets/icons/IconSubstack.svg";
import IconShare from "@/assets/icons/IconShare.svg";
import { SITE } from "@/config/index";

// Social media links (header/footer)
type SocialLink = {
  name: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
  href: string;
  rel?: "me";
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
    rel: "me",
  },
  {
    name: "X",
    href: "https://x.com/screenack",
    linkTitle: `${SITE.title} on X`,
    icon: IconBrandX,
    rel: "me",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/kyleskrinak/",
    linkTitle: `${SITE.title} on LinkedIn`,
    icon: IconLinkedin,
    rel: "me",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/kyle.skrinak",
    linkTitle: `${SITE.title} on Facebook`,
    icon: IconFacebook,
    rel: "me",
  },
  {
    name: "Substack",
    href: "https://screenack.substack.com/",
    linkTitle: `${SITE.title} on Substack`,
    icon: IconSubstack,
    rel: "me",
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
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/sharing/share-offsite/?url=",
    linkTitle: `Share this post on LinkedIn`,
    icon: IconLinkedin,
    isNativeShare: false,
  },
] as const;
