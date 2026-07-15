---
name: write-a-skill
description: Create new agent skills with proper structure, progressive disclosure, and bundled resources. Use when user wants to create, write, or build a new skill.
---

# Writing Skills

## Process

1. **Gather requirements** - use the conversation and repository context first. Ask only for missing decisions that materially affect the skill:
   - What task/domain does the skill cover?
   - What specific use cases should it handle?
   - Does it need executable scripts or just instructions?
   - Any reference materials to include?

2. **Draft the skill** - create or update files under `skills/<category>/<skill-name>/`:
   - `SKILL.md` with concise instructions
   - Additional reference files if content exceeds 100 lines or is rarely needed
   - Utility scripts if deterministic operations are needed

3. **Review fit** - verify the skill against the requested use cases and this repository's existing style. When editing an existing skill, preserve its structure unless there is a clear reason to change it.

## Skill Structure

```text
skills/<category>/skill-name/
├── SKILL.md           # Main instructions (required)
├── REFERENCE.md       # Detailed docs (if needed)
├── EXAMPLES.md        # Usage examples (if needed)
└── scripts/           # Utility scripts (if needed)
    └── helper.js
```

## SKILL.md Template

```md
---
name: skill-name
description: Brief description of capability. Use when [specific triggers].
---

# Skill Name

## Quick Start

[Minimal working example]

## Workflows

[Step-by-step processes with checklists for complex tasks]

## Advanced Features

[Link to separate files: See [REFERENCE.md](REFERENCE.md)]
```

## Description Requirements

The description is **the only thing your agent sees** when deciding which skill to load. It's surfaced in the system prompt alongside all other installed skills. Your agent reads these descriptions and picks the relevant skill based on the user's request.

**Goal**: Give your agent just enough info to know:

1. What capability this skill provides
2. When/why to trigger it (specific keywords, contexts, file types)

**Format**:

- Max 1024 chars
- Write in third person
- First sentence: what it does
- Second sentence: "Use when [specific triggers]"

**Good example**:

```text
Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.
```

**Bad example**:

```text
Helps with documents.
```

The bad example gives your agent no way to distinguish this from other document skills.

## When to Add Scripts

Add utility scripts when:

- Operation is deterministic (validation, formatting)
- Same code would be generated repeatedly
- Errors need explicit handling

Scripts save tokens and improve reliability vs generated code.

## When to Split Files

Split into separate files when:

- `SKILL.md` exceeds 100 lines
- Content has distinct domains (finance vs sales schemas)
- Advanced features are rarely needed

Keep references one level deep where possible: `SKILL.md` can link to `REFERENCE.md`, but avoid reference files that require chasing more reference files.

## Review Checklist

After drafting, verify:

- [ ] Description includes triggers ("Use when...")
- [ ] Skill lives under `skills/<category>/<skill-name>/`
- [ ] `SKILL.md` is concise and progressively discloses details through references
- [ ] No time-sensitive info
- [ ] Consistent terminology
- [ ] Concrete examples included when useful
- [ ] References are one level deep where possible
- [ ] Relative links resolve after any file renames or splits
