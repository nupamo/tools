# tools — project instructions

## Product contract

- Keep the home page to a name, one-line description and links with tool name, description and category.
- List only working tools. No marketing sections, mock statistics or coming-soon tools.
- Tool pages show server use and exact on-device model directly under the title. Say “none” when no model is used.
- Desktop workspaces fit the viewport; mobile may scroll. Keep actions reachable at short viewport heights.
- No manual, account wall, analytics or photo upload service.

## Architecture

- Astro static output; framework-specific interactions live in tool islands.
- Use Astryx Neutral theme tokens and real Astryx controls. Semantic native markup is used for Astro page layout, file selection, canvases and download controls.
- Do not introduce site-wide SPA routing or a server adapter.
- Register tools in `src/data/tools.ts`.
- Keep image processing independent of React in `src/lib/photo/` and run it in a Web Worker.
- Preview can be scaled, but export must reprocess original pixels at the original resolution.
- Never change the original file or send image pixels off the device.
- Do not describe colour-based skin masking as face detection, segmentation or AI.

## Astryx references

Astryx 0.7.0 is installed. Use `npm run astryx -- component Button`, `component Slider`, `docs tokens`, `docs layout` and `build "<idea>"` to inspect APIs. Prefer existing structures when changing a page; the general three-pane editor template is deliberately reduced to the two regions this photo tool needs.

## Validation

Run `npm run check`, `npm test` and `npm run build` after code changes.
For subpath deployments also check `BASE_PATH=/tools/ npm run build`.
Document browser verification limits accurately; a successful build is not a browser interaction test.
