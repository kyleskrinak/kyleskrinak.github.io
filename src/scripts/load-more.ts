import { linkWithBase } from "@/utils/linkWithBase";

type PostJson = {
  title: string;
  url: string;
  pubDate: string;
  updatedDate: string | null;
  description: string;
};

const CALENDAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block size-6 min-w-5.5 scale-90 icon icon-tabler icons-tabler-outline icon-tabler-calendar-week"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M7 14h.013" /><path d="M10.01 14h.005" /><path d="M13.01 14h.005" /><path d="M16.015 14h.005" /><path d="M13.015 17h.005" /><path d="M7.01 17h.005" /><path d="M10.01 17h.005" /></svg>`;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const parts = dateFormatter.formatToParts(new Date(iso));
  const day = parts.find(p => p.type === "day")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const year = parts.find(p => p.type === "year")?.value;
  return `${day} ${month}, ${year}`;
}

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    c =>
      (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<
          string,
          string
        >
      )[c]!
  );
}

let cachedPosts: PostJson[] | null = null;
let cachedPostsPromise: Promise<PostJson[]> | null = null;

async function getPosts(): Promise<PostJson[]> {
  if (cachedPosts) return cachedPosts;
  cachedPostsPromise ??= fetch(linkWithBase("/posts/index.json")).then(r => {
    if (!r.ok) {
      throw new Error(`Failed to load posts/index.json: ${r.status} ${r.statusText}`);
    }
    return r.json();
  });
  cachedPosts = await cachedPostsPromise;
  return cachedPosts;
}

function computeBatchSize(list: HTMLUListElement): number {
  const li = list.querySelector("li");
  if (!li) return 5;

  const rectHeight = li.getBoundingClientRect().height;
  const style = window.getComputedStyle(li);
  const marginHeight = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  const liHeight = rectHeight + marginHeight;

  if (liHeight <= 0) return 5;
  return Math.max(Math.floor(window.innerHeight / liHeight), 5);
}

function buildCardHtml(post: PostJson): string {
  const isModified = !!(post.updatedDate && new Date(post.updatedDate) > new Date(post.pubDate));

  const revisedMarkup = isModified
    ? `<span aria-hidden="true" class="text-sm">&middot;</span>
       <span class="text-sm">Revised on:</span>
       <time class="dt-updated text-sm" datetime="${post.updatedDate}">${formatDate(post.updatedDate!)}</time>`
    : "";

  return `
    <a href="${escapeHtml(post.url)}" class="inline-block text-lg font-medium text-accent decoration-dashed underline-offset-4 hover:underline focus-visible:no-underline focus-visible:underline-offset-0">
      <h2>${escapeHtml(post.title)}</h2>
    </a>
    <div class="flex flex-wrap items-center gap-x-2 opacity-80">
      ${CALENDAR_ICON_SVG}
      <time class="dt-published text-sm" datetime="${post.pubDate}">${formatDate(post.pubDate)}</time>
      ${revisedMarkup}
    </div>
    <p>${escapeHtml(post.description)}</p>
  `;
}

function appendPosts(list: HTMLUListElement, posts: PostJson[]): HTMLLIElement[] {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items: HTMLLIElement[] = [];

  posts.forEach((post, i) => {
    const li = document.createElement("li");
    li.className = "my-6";
    li.innerHTML = buildCardHtml(post);

    if (!reduceMotion) {
      li.style.opacity = "0";
      li.style.transform = "translateY(4px)";
      li.style.animation = "load-more-fade-in 300ms ease-out forwards";
      li.style.animationDelay = `${i * 60}ms`;
    }

    list.appendChild(li);
    items.push(li);
  });

  return items;
}

function init() {
  const list = document.querySelector<HTMLUListElement>("ul[data-load-more]");
  if (!list) return;

  const nav = document.querySelector<HTMLElement>('nav[aria-label="Pagination Navigation"]');

  const button = document.createElement("button");
  button.type = "button";
  button.id = "load-more-btn";
  button.textContent = "Load more posts";
  button.className = "group flex items-center justify-center gap-1 hover:text-accent mx-auto mt-4 mb-8";

  const status = document.createElement("div");
  status.id = "load-more-status";
  status.className = "sr-only";
  status.setAttribute("aria-live", "polite");

  if (nav) {
    nav.replaceWith(button);
    button.insertAdjacentElement("afterend", status);
  } else {
    return;
  }

  let renderedCount = list.children.length;

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      const posts = await getPosts();
      const batchSize = computeBatchSize(list);
      const nextBatch = posts.slice(renderedCount, renderedCount + batchSize);

      const items = appendPosts(list, nextBatch);
      renderedCount += nextBatch.length;

      status.className = "sr-only";
      status.textContent = `${nextBatch.length} more post${nextBatch.length === 1 ? "" : "s"} loaded`;

      if (renderedCount >= posts.length) {
        button.remove();
        items[0]?.querySelector("a")?.focus();
      } else {
        button.disabled = false;
      }
    } catch (err) {
      console.error("Failed to load more posts:", err);
      cachedPostsPromise = null;
      status.className = "";
      status.textContent = "Sorry, we couldn't load more posts. Please try again.";
      button.disabled = false;
    }
  });
}

document.addEventListener("astro:page-load", init);
