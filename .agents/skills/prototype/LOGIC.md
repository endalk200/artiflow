# Logic Prototype

A single, self-contained HTML file — a **shareable demo** — that lets anyone drive a state model by clicking buttons. Use this when the question is about **business logic, state transitions, or data shape** — the kind of thing that looks reasonable on paper but only feels wrong once you push it through real cases.

Because it is one file with nothing to install, you can hand it to a non-developer — a designer, PM, or domain expert — and let them feel the model for themselves. It speaks their domain language, not the code's.

## When this is the right shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model actually let me represent the case where..."
- "I want to feel out what the API should look like before writing it."
- Anything where someone wants to **press buttons and watch state change**.

If the question is "what should this look like" — wrong branch. Use [UI.md](UI.md).

## Process

### 1. State the question

Before writing code, write down what state model and what question you're prototyping. Put the paragraph at the top of the demo in a visible introduction, not only in a comment. A logic prototype that answers the wrong question is pure waste — make the question explicit so it can be checked later, whether the user is watching now or returning to it AFK.

### 2. Isolate the logic in a portable module

Put the actual logic — the part answering the question — in a single `<script>` block behind a small, pure interface whose shape can guide the real implementation later.

The right shape depends on the question:

- **A pure reducer** — `(state, action) => state`. Good when actions are discrete events and state is a single value.
- **A state machine** — explicit states and transitions. Good when "which actions are even legal right now" is part of the question.
- **A small set of pure functions** over a plain data type. Good when there is no implicit current state — only transformations.
- **A class or module with a clear method surface** when the logic genuinely owns ongoing internal state.

Pick whichever shape best fits the question, not whichever is easiest to wire to a page. Keep it pure: no DOM access, `document` calls, or button handlers inside the logic. The page calls into it; nothing flows the other direction.

This separation preserves the design evidence. Once the question is answered, the pure logic and HTML shell remain together in the evidence snapshot. Reimplement the validated design in production with the project's normal tests, error handling, and conventions rather than promoting prototype code directly.

### 3. Build the shareable HTML file

Use one file with plain HTML, CSS, and JavaScript — no framework, bundler, server, or external runtime. Everything is inline so it opens directly and survives being shared on its own.

Write it for a non-developer. Every label uses domain language rather than code vocabulary. Explain in plain words what is happening.

Lay it out with a clean hierarchy, top to bottom:

1. **Title and one-line explanation** of what this demo lets the user explore — the question from step 1.
2. **Current state** — the full relevant state rendered as a readable panel with labelled fields, not a raw JSON dump. Re-render after every click and, where useful, call out what just changed.
3. **Free-play buttons** — one button per action, always available, so anyone can exercise the model in any order. Each click dispatches its action and re-renders the state.
4. **Guided walkthroughs** — one scenario per tab. Each tab explains the situation and what to watch for, then provides the ordered buttons to press. Each step is a real button: clicking it performs that action and advances the walkthrough. Starting a walkthrough resets to a known state so it behaves the same every time.

Choose scenarios that expose the awkward cases: the happy path, a tricky edge case, and an action that should be illegal. These are the cases that are hardest to reason about on paper.

Keep the presentation beautiful but restrained: clean typography, generous spacing, and one accent colour. The state and controls carry the attention.

### 4. Hand it over

Give the user the file and, when the environment supports it, open it for them. They can click through the walkthroughs and free-play when convenient. Feedback such as "that should not be possible" or "I assumed this would be different" identifies bugs in the idea. Add actions or scenarios as those questions surface.

### 5. Capture the answer and evidence

Once the prototype answers its question, follow the capture order in [SKILL.md](SKILL.md). Record the question and verdict, then snapshot the complete runnable HTML experiment before changing or removing it. The evidence commit keeps the experiment reproducible outside the main branch; the implementation branch gets a production reimplementation of the validated design and no HTML shell.

## Anti-patterns

- **Don't add tests.** A prototype that needs tests is no longer a prototype.
- **Don't wire it to the real database.** Use in-memory state unless the question is specifically about persistence.
- **Don't generalise.** The prototype answers one question, not hypothetical future requirements.
- **Don't blur the logic and the page together.** If the pure module references the DOM, `document`, or button handlers, it is no longer portable. Keep the page as a thin shell over the logic.
- **Don't reach for a framework, bundler, or server.** One directly-openable file is the shareable artifact.
- **Don't ship the HTML shell into production.** Reimplement the validated design with production tests, error handling, accessibility, security, and project conventions.
