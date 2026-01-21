import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, 'src', 'content', 'blog');

function getFirstParagraph(body) {
  // Get first non-empty, non-markdown line from body as description
  const lines = body.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[') && !trimmed.startsWith('<') && !trimmed.startsWith('|')) {
      // Remove markdown formatting and get first 120 characters
      let clean = trimmed
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
        .replace(/\*\*([^\*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^\*]+)\*/g, '$1'); // Remove italic
      return clean.substring(0, 120) + (clean.length > 120 ? '...' : '');
    }
  }
  return 'Blog post';
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) return false;

  const [, frontmatterStr, body] = match;
  const frontmatter = yaml.load(frontmatterStr);

  // Check if description exists
  if (frontmatter.description) {
    return false; // Already has description
  }

  // Add description from first paragraph
  frontmatter.description = getFirstParagraph(body);

  // Dump back to YAML
  const fixed = yaml.dump(frontmatter, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    skipInvalid: false,
    flowLevel: -1,
  });

  const newContent = `---\n${fixed}---\n${body}`;
  fs.writeFileSync(filePath, newContent, 'utf-8');
  return true;
}

const files = fs.readdirSync(blogDir)
  .filter(f => f.endsWith('.md'))
  .sort();

let fixed = 0;
files.forEach(file => {
  const filePath = path.join(blogDir, file);
  if (fixFile(filePath)) {
    console.log(`Added description to: ${file}`);
    fixed++;
  }
});

console.log(`\nAdded descriptions to ${fixed} files`);
