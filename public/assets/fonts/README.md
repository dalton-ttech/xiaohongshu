# Entry typography

The visitor entry uses locally hosted WOFF2 subsets served by Google Fonts:

- [Manrope](https://fonts.google.com/specimen/Manrope), weights 400–700: Latin labels and visitor numbers. License: `manrope-OFL.txt`.
- [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC), weights 400–700: the entry's Chinese copy and visitor badge. License: `noto-OFL.txt`.

Downloaded 2026-10-12. The Chinese subset contains the characters used in `functions/access-page.js` and `public/assets/access.js`; unlisted characters fall back to the device's Chinese font. No runtime request to an external font service is required.
