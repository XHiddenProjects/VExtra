# Accessibility

Vextra Studio should be usable by as many people as possible – both the **editor** you work in and the **games** you make with it. This page says what is supported today, what is not yet, and how to help.

## The editor

**What works today**
- **Themes:** seven built-in themes, including a light one (`vextra-light`) and dark ones. Pick one in Settings; themes are plain JSON files in `themes/`, so you can make a high-contrast one.
- **Editor text size and font:** Settings → Editor (font size, font family, tab size, word wrap).
- **Keyboard:** the code editor, menus, dialogs and the Help pages can be used from the keyboard. The full list is in Help → Keyboard shortcuts.
- **Reduced motion:** the small progress animations slow down when your system asks for reduced motion.
- **Plain-language blocks:** every block has a text description in the Logic tab, so a graph can be read as text.

**Known gaps (we are working on these)**
- The visual editors – the block graph, the 2D / 3D viewports and the paint / animation tools – are drawn on a canvas and are **not yet screen-reader friendly**. Most of what they do can also be done from the Inspector panels, which are ordinary form fields.
- ARIA labels, roles and focus order are incomplete in some panels.
- There is no dedicated high-contrast theme yet.
- Drag-and-drop actions (blocks, UI layout) do not all have a keyboard alternative yet. In *Edit UI layout* you can type the exact X / Y and pick the anchor instead of dragging.

## Games you make

Vextra gives you tools to build accessible games; nothing is forced on you, so please use them:
- **Never make the microphone or camera the only way to play.** Voice Noise has a *test key* (default M), Voice Command can be paired with keys, and the example games all work without a mic or camera.
- **Offer more than one control.** The examples accept WASD *and* arrow keys, and mouse *and* keyboard (Echo Pads: click, 1-4 or arrows).
- **Don't rely on colour alone.** Echo Pads gives each pad its own note and size change as well as a colour flash.
- **Readable text.** Use Label / Bar blocks (size, colour and anchor are settings) and keep text large and high-contrast against the background. Use **Edit UI layout** to move HUD items away from where the action happens.
- **Avoid flashing.** Don't flash large areas more than three times per second (screen shake and Shader effects included); give players a way to turn effects off.
- **Pause and timing.** Use the Pause Game block, and avoid timers that cannot be extended unless the challenge needs it.
- **Sound.** Give important sounds a visual twin (a label, an icon or a flash) and let players mute.

## Report a problem or suggest a fix

Open an issue (see `ISSUE_TEMPLATES.md`) and tick *accessibility*, or send a pull request (see `CONTRIBUTING.md`). Please say which part of Vextra Studio, what you use (screen reader, magnifier, keyboard only, switch device…) and what happened. Accessibility fixes are welcome in any release.

Security problems go to `SECURITY.md`, not the public issue list.
