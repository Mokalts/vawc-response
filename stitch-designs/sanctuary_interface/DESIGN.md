# Design System Strategy: Dignified Resilience

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Sanctuary Archive**. 

In the context of VAWC (Violence Against Women and Children) reporting, the UI must transcend being a mere "tool" and become a digital safe harbor. We move away from the cold, clinical nature of standard government forms by adopting a **High-End Editorial** approach. This means utilizing generous whitespace, intentional asymmetry, and a "soft-touch" layering system that feels bespoke and protective. 

By avoiding harsh lines and standard grid-block layouts, we create a flow that feels intuitive and human. The goal is to provide a sense of agency and dignity to the user through a interface that breathes, rather than one that demands.

---

## 2. Colors & Tonal Depth
The palette is rooted in calming botanicals and warm earth tones. We avoid pure blacks and harsh whites to reduce cognitive eye strain and emotional agitation.

### The "No-Line" Rule
To maintain a premium, seamless feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined through background color shifts or subtle tonal transitions. 
- Use `surface-container-low` (#fcf1f4) for subtle background shifts against the main `background` (#fff8f8).
- Use `tertiary-container` (#00855e) for success states, but never outline them.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of fine, heavy-weight paper.
- **Level 0 (Base):** `surface` (#fff8f8) - The foundational canvas.
- **Level 1 (Sections):** `surface-container` (#f6ebee) - Used for grouping content blocks.
- **Level 2 (Interactive Cards):** `surface-container-lowest` (#ffffff) - Used to make reporting cards "pop" subtly from the section background.

### The "Glass & Gradient" Rule
For high-priority CTAs or floating navigation, use a semi-transparent `primary` (#953f58) with a 20px backdrop-blur. This "frosted glass" effect creates a sense of modernity and depth without adding visual clutter.
- **Signature Texture:** Primary buttons should use a subtle linear gradient from `primary` (#953f58) to `primary-container` (#b45770) at a 135-degree angle. This prevents the "flat" look and gives the button a soft, tactile presence.

---

## 3. Typography
We utilize **Inter** for its exceptional legibility and neutral, authoritative tone.

*   **Display & Headlines:** Set in `primary` (#953f58). These should feel like editorial titles—spaced generously with a `-0.02em` letter-spacing for a high-end feel.
*   **Body Text:** Minimum `16px` (`body-lg`). Use `on-surface-variant` (#544246) for body text rather than pure black to keep the tone "soft" and approachable.
*   **Hierarchy as Comfort:** Use `headline-lg` (2rem) for page titles to provide clear orientation. Use `title-md` (1.125rem) for form labels to ensure they are unmistakable for users under stress.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering**, not structural rigidity.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that guides the eye toward interaction points without the "noise" of heavy shadows.
*   **Ambient Shadows:** For floating elements (like an emergency exit button), use a shadow with a 40px blur and 6% opacity, using the `primary` color (#953f58) as the shadow tint. This mimics natural light passing through colored glass.
*   **The "Ghost Border" Fallback:** If a container requires further definition for accessibility, use the `outline-variant` token (#d9c0c4) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** Large (height: 56px+), rounded (`xl`: 3rem), using the signature rose gradient. 
*   **Secondary:** Ghost style. No background, `primary` text, with a `surface-variant` hover state.
*   **Tactile Feedback:** Ensure a minimum tap target of 48x48px, but aim for 60px for reporting actions to accommodate shaking or unsteady hands.

### Cards & Lists
*   **The "No-Divider" Rule:** Forbid the use of horizontal rules. Separate list items using `spacing-4` (1.4rem) of vertical whitespace or by alternating background tones between `surface-container-low` and `surface-container-lowest`.

### Input Fields
*   **Style:** Background-filled (`surface-container-high`), no border, `md` (1.5rem) corner radius. 
*   **Focus State:** A soft 4px glow using `secondary-fixed-dim` (#f6b5ca) rather than a sharp outline.
*   **Labels:** Always visible, never floating. Use `title-sm` (1rem) in `on-surface`.

### Emergency "Quick Exit" Component
*   A persistent floating action button (FAB) using `tertiary` (#00694a). It should use glassmorphism (80% opacity) and sit in the bottom-right corner with a high elevation shadow to ensure it is always findable.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins (e.g., 10% left, 15% right) on desktop to create an editorial, non-templated look.
*   **Do** use "Breathing Room." If you think there is enough padding, add `spacing-2` (0.7rem) more.
*   **Do** prioritize "Simple Tap" interactions. Avoid long presses, swipes, or complex gestures.

### Don't
*   **Don't** use icons without text labels. Icons can be misinterpreted; clear text is safer.
*   **Don't** use "playful" animations. Keep transitions linear and functional (300ms duration).
*   **Don't** use high-contrast red for errors. Use `on-error-container` (#93000a) on a `error-container` (#ffdad6) background to keep the interface calm even during validation errors.

---

## 7. Spacing & Rhythm
Rhythm should be felt, not seen. Use the **Spacing Scale** religiously to maintain a mathematical harmony.
*   **Outer Page Margins:** `spacing-8` (2.75rem) on mobile; `spacing-20` (7rem) on desktop.
*   **Content Block Gap:** `spacing-10` (3.5rem) to ensure the user never feels overwhelmed by information density.