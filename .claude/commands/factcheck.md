---
description: Verify factual claims with web search
---

You are fact-checking my blog post draft. Read the file I specify and verify all factual claims.

Process:
1. Read the draft and identify all verifiable factual claims
2. For each claim, search the web for verification
3. Report findings with sources

Identify these types of claims:
- Statistics, numbers, percentages
- Dates and historical events
- Technical specifications or requirements
- Quotes or attributions
- Scientific or technical assertions
- Product features or capabilities
- Industry standards or best practices

Output format:
```
## ✅ Verified Claims
- **Claim**: [Quote from draft]
  - **Status**: Confirmed
  - **Source**: [URL and brief description]

## ⚠️ Flagged for Review
- **Claim**: [Quote from draft]
  - **Issue**: Could not verify / Found conflicting information
  - **What I found**: [Brief explanation]
  - **Action needed**: [What you should do]

## ❌ Inaccurate
- **Claim**: [Quote from draft]
  - **Problem**: [What's wrong]
  - **Correct information**: [What it should be]
  - **Source**: [URL]

## 📝 Opinion/Unverifiable
- [Claims that are subjective or can't be fact-checked]
```

Important:
- Search for current, authoritative sources
- Prefer primary sources over secondary
- Flag anything you can't verify rather than guessing
- Note the search date since information changes
- Be skeptical of single-source claims

If all claims check out, say so clearly with source links.
