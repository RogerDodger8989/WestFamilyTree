# GLOBAL DESIGN SYSTEM & UI RULES
You must strictly follow these rules for ALL UI generation and modifications. Do not deviate from this standard unless explicitly told to do so.

1. **Visual Style (Windows 11 Desktop):** The application must strictly mimic a standard Windows 11 desktop application aesthetic. Avoid modern web-like vibrant colors or heavy shadows unless specifically requested.

2. **Buttons:** - ALWAYS use standard Windows 11 neutral gray buttons for default actions. 
   - NO colorful buttons. 
   - Buttons must have consistent padding, a subtle light gray/dark gray border, and slightly rounded corners (e.g., 4px border-radius).
   - Hover states should slightly darken the gray background, matching standard Windows behavior.

3. **Modals vs Dialogs (STRICT RULE):**
   - ALWAYS use custom in-app Modals (overlays within the app) for all user prompts, confirmations, warnings, and settings.
   - NEVER use native OS dialog boxes.
   - NEVER use native browser dialogs like `window.alert()`, `window.confirm()`, or `window.prompt()`.

4. **Layout & Placement:**
   - Button placement inside modals must be 100% consistent. 
   - Action buttons (e.g., "OK", "Cancel", "Save") must ALWAYS be placed at the bottom right of the modal.
   - The primary action button (e.g., "OK") should be on the far right, with the secondary action (e.g., "Cancel") immediately to its left.

5. **Consistency:** - Do not invent new UI components, layouts, or colors for each new view. 
   - If a button or modal is needed, strictly apply the rules above without me having to remind you.