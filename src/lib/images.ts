/**
 * Astro Image Import Map
 *
 * Automatically imports images from src/assets/images/ (top-level only, no subdirectories)
 * for type-safe, optimized image handling. Uses Vite's import.meta.glob() to eagerly
 * import all matching image files at build time.
 *
 * How it works:
 * 1. Glob pattern matches images in src/assets/images/ (one level deep)
 * 2. Vite eagerly imports them at build time (eager: true)
 * 3. Creates a map with filename as key → ImageMetadata as value
 * 4. Components use getOptimizedImage() to look up images by filename
 *
 * Adding new images:
 * - Add files directly to src/assets/images/ (not subdirectories)
 * - No manual registration needed
 * - Supported formats: jpg, jpeg, png, webp, gif, svg
 *
 * @example
 * // Add image: src/assets/images/my-photo.jpg
 * // Use in component: getOptimizedImage("my-photo.jpg")
 * // Returns: ImageMetadata for Astro's <Image> component
 */

import type { ImageMetadata } from 'astro';

/**
 * Automatically import all images using glob pattern
 * - Matches all common image formats (both lowercase and uppercase extensions)
 * - eager: true = imports at build time (not lazy-loaded)
 * - Returns: { path: { default: ImageMetadata } }
 *
 * INTENTIONAL DESIGN: eager: true is used deliberately to ensure all images
 * are available in the imageMap at runtime. This simplifies component logic
 * and prevents runtime errors from missing images. The performance trade-off
 * is acceptable for this site's image count. If build time becomes an issue,
 * consider switching to lazy imports or a dedicated hero-images directory.
 */
const images = import.meta.glob<{ default: ImageMetadata }>(
	'../assets/images/*.{jpg,jpeg,png,webp,gif,svg,JPG,JPEG,PNG,WEBP,GIF,SVG}',
	{ eager: true }
);

/**
 * Image map for fast filename → ImageMetadata lookup
 * Key: just the filename (e.g., "flatpanbake.jpg")
 * Value: ImageMetadata for Astro's Image component
 */
export const imageMap: Record<string, ImageMetadata> = {};
for (const path in images) {
	// Extract filename from full path: "../assets/images/photo.jpg" → "photo.jpg"
	const filename = path.split('/').pop();
	if (filename) {
		imageMap[filename] = images[path].default;
	}
}

/**
 * Get optimized image metadata by filename
 *
 * Looks up an image in the imageMap and returns its metadata for use with
 * Astro's <Image> or <Picture> components. By returning ImageMetadata, it allows
 * those components to apply their built-in optimizations, such as:
 * - Multiple responsive sizes based on component configuration
 * - Optional format conversion (e.g., WebP) when configured on the component
 * - Compression and other optimizations handled by astro:assets
 * - Lazy loading and async decoding based on component props
 *
 * @param imagePath - Full path like "../../assets/images/flatpanbake.jpg" or just "flatpanbake.jpg"
 * @returns ImageMetadata for use with astro:assets Image component, or undefined if not found
 *
 * @example
 * // In a component:
 * const image = getOptimizedImage("flatpanbake.jpg");
 * if (image) {
 *   <Image src={image} alt="..." />
 * }
 *
 * @example
 * // With full path (extracts filename automatically):
 * const image = getOptimizedImage("../../assets/images/photo.jpg"); // → looks up "photo.jpg"
 */
export function getOptimizedImage(imagePath: string | undefined): ImageMetadata | undefined {
	if (!imagePath) return undefined;

	// Extract filename from path: "../../assets/images/photo.jpg" → "photo.jpg"
	const filename = imagePath.split('/').pop();
	if (!filename) return undefined;

	// Look up in imageMap - returns undefined if not found
	return imageMap[filename];
}
