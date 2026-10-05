# TapLocal

Independent frontend containing only the approved header and Hero. Native HTML, CSS and JavaScript; no package installation or external workspace dependencies.

Run `node server.mjs` and open http://127.0.0.1:4173.

The supplied plaque PNGs are copied unchanged into `assets/`. The header logo uses a cropped SVG viewport of the supplied Instagram asset, preserving its original artwork. Both arrow buttons exchange the foreground product using one state value and CSS transforms. Reduced motion disables transitions and entrance effects.

Responsive breakpoints: 1199, 979, 767, 480 and 390px. Below 980px the Hero stacks and navigation collapses. Below 481px the CTAs stack.

Navigation retains the specified future section anchors. Those sections and checkout are intentionally outside this implementation.

The generic React parallax attachment is a reference only: its multi-row layout and animation dependencies conflict with the specific two-plaque Hero requirements. A React/Tailwind/shadcn setup is not required by this standalone implementation.
