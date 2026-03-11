import type { Props } from "astro";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconShare from "@/assets/icons/IconShare.svg";
import { SITE } from "@/config/index";

// Discriminated union to prevent invalid share configurations
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
  isNativeShare?: false;
};

type Social = NativeShare | ExternalShare;

export const SOCIALS: Social[] = [
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

export const SHARE_LINKS: Social[] = [
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
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
  },
] as const;
