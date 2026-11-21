# Navigation motion

Use motion to communicate the relationship between screens. Keep the user's Reduce Motion setting in mind and avoid dimming or blurring content behind bottom sheets.

- **Forward and back within Books and Settings:** use `TransitionDeck` from `src/TransitionDeck.tsx`. Supply a stable scene key and a direction function. Forward navigation moves the current scene left and the next scene in from the right; back navigation reverses it. Both scenes use the shared `navigationMotion` timing. Departing scenes do not accept touches or accessibility focus.
- **Bottom sheets:** book information and the note editor use native slide modals with a transparent background. The dictionary sheet uses an animated slide with the shared timing. The reader menu opens without animation. All have transparent outside areas that can be tapped to dismiss them.
- **Top-level Settings and Prashnavali information:** these still use native full-screen slide modals. Settings pages inside the modal use horizontal navigation. Prashnavali uses the router's native navigation to enter its screen.
- **Other motion:** the reading walkthrough fades over a dimmed background to focus attention; the section switcher is an anchored popover. The reader's pinch-driven full-screen layout and its page scrolling have their own interactions. System alerts are controlled by the operating system.

When adding a drill-down screen, use `TransitionDeck` if it lives in an existing state-driven flow, or an equivalent native stack push for router screens. Reserve bottom sheets for temporary actions; do not add a dark or blurred backdrop. Test forward and back, interruptions, screen rotation and Reduce Motion on devices.
