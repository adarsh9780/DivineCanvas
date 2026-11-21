# Navigation motion

Use motion to communicate the relationship between screens. Keep the user's Reduce Motion setting in mind and avoid dimming or blurring content behind bottom sheets.

- **Main sections:** Expo Router native tabs switch between Books, Explore and Settings. Hide the tab bar during full-screen reading. Native tabs adapt to the device and operating system.
- **Settings drill-down:** use the native stack under `src/app/(tabs)/settings` for system back gestures and transitions. The Settings root is a tab, not a modal.
- **Book screens:** the chapter list uses a native stack under `src/app/(tabs)/(books)`; existing reader pages use `TransitionDeck` from `src/TransitionDeck.tsx`. Departing scenes do not accept touches or accessibility focus.
- **Bottom sheets:** book information and the note editor use native slide modals with a transparent background. The dictionary sheet uses an animated slide with shared timing. The reader actions use a native platform menu anchored to the toolbar; web uses a fallback.
- **Explore:** Prashnavali is opened from Explore using the router. Its board deliberately disables the back swipe to avoid interfering with finger movement; its information page uses a full-screen modal.
- **Other motion:** the reading walkthrough fades over a dimmed background to focus attention. The reader's pinch-driven full-screen layout and page scrolling have their own interactions. System alerts are controlled by the operating system.

Use native stack routes for new drill-down pages. Reserve bottom sheets for temporary actions; do not add a dark or blurred backdrop. Test forward and back, interruptions, screen rotation and Reduce Motion on devices.
