// Astro Image Import Map
// All blog post hero images imported here for type-safe, optimized image handling

import momMe from '../assets/images/19-10-31-mom-me.jpg';
import megaphone from '../assets/images/190831-megaphone.jpg';
import fathersday from '../assets/images/20160619-fathersday.jpg';
import jekyllGarden from '../assets/images/21-04-02-jekyll-garden.jpg';
import aiModernization from '../assets/images/ai-modernization-workflow.jpg';
import confusedMeme from '../assets/images/confusedmeme.jpg';
import drupalLogo from '../assets/images/drupal_logo.png';
import emptyDining from '../assets/images/empty_dining.jpg';
import flatpanbake from '../assets/images/flatpanbake.jpg';
import funAtScale from '../assets/images/fun-at-scale.svg';
import hotTub from '../assets/images/hot_tub.jpg';
import punchCard from '../assets/images/punch_card.jpg';
import typewriterToLaptop from '../assets/images/typewriter-to-laptop.jpg';

import type { ImageMetadata } from 'astro';

// Map filenames to imported image modules for dynamic lookup
export const imageMap: Record<string, ImageMetadata> = {
	'19-10-31-mom-me.jpg': momMe,
	'190831-megaphone.jpg': megaphone,
	'20160619-fathersday.jpg': fathersday,
	'21-04-02-jekyll-garden.jpg': jekyllGarden,
	'ai-modernization-workflow.jpg': aiModernization,
	'confusedmeme.jpg': confusedMeme,
	'drupal_logo.png': drupalLogo,
	'empty_dining.jpg': emptyDining,
	'flatpanbake.jpg': flatpanbake,
	'fun-at-scale.svg': funAtScale,
	'hot_tub.jpg': hotTub,
	'punch_card.jpg': punchCard,
	'typewriter-to-laptop.jpg': typewriterToLaptop,
};

/**
 * Get optimized image metadata by filename
 * @param imagePath - Full path like "../../assets/images/flatpanbake.jpg" or just "flatpanbake.jpg"
 * @returns ImageMetadata for use with astro:assets Image component
 */
export function getOptimizedImage(imagePath: string | undefined): ImageMetadata | undefined {
	if (!imagePath) return undefined;

	// Extract filename from path
	const filename = imagePath.split('/').pop();
	if (!filename) return undefined;

	return imageMap[filename];
}
