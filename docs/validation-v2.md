# LabFlow 2.0 — visual and motion validation

Verified 12 October 2026. Clinical engine source is unchanged in this release.

## Automated checks

- `npm test`: 16 passing tests: 12 clinical workflow invariants and four motion tests covering continuous waypoint travel, pause/reduced motion, interruption/retargeting, and independence from frame interval.
- `python tests/browser_test.py`: 12 passing browser groups, covering desktop and 390 px mobile layout, pause/step, three linked paths, STAT patient creation, pneumatic outage, LIS versioned correction/manual authorization, CSV and JSON export/import, validation, help, and WebGL-unavailable fallback.
- `python tests/render_test.py`: six passing browser groups, covering actual GLB loading, joint transforms, instanced rendering, paused poses, quality/label/camera controls, 60 distinct motion positions without engine-clock mutation, geometry reuse after repeated resets, and reduced-motion preference.
- `python tests/scene_controls_test.py`: three passing groups for fullscreen entry/exit, sustained slow-frame quality adaptation versus fixed high quality, and usable fallback after blocked model downloads. Adaptation supplies synthetic display intervals with GPU submission temporarily stubbed; this is a policy test, not a performance measurement. Fullscreen exit uses the application's toggle because synthetic Escape does not exit headless Chromium's native fullscreen state.

Browser tests use Chromium headless with SwiftShader software WebGL. No page exceptions or failed asset requests were recorded in the rendering suite. Screenshots and raw reports are in ignored `.qa/`; these are not published.

## Visual inspection

Reviewed full-page desktop/mobile, top-view focus, and Blender Cycles asset previews. Adjusted the seated human pose to match the collection-chair cushion and aligned the animated conduit with the exported pneumatic terminal connectors. Fixed and re-exported knee parenting from Blender; the manifest now records asserted world-space shoulder, hip and knee pivots.

The environment has 129,864 triangles in 17 material groups. The reusable person has 8,240 triangles in 18 articulated mesh groups. An initial browser scene with 15 people and 26 specimen tokens used 89 renderer draw calls including shadow passes. Repeated resets retained the same allocated geometry-buffer count after the selection ring had been exercised.

## Performance interpretation

Replaced 400 ms position jumps and the previous 33 ms render gate with display-frame interpolation, shared geometry, object reuse, and GPU instancing. When paused, an unchanged camera and scene do not redraw. Auto quality responds to rolling frame intervals; low quality disables shadows, and high quality uses a 2048 px shadow map. Drawing and animation do not write to clinical records or their timestamps.

These checks establish behavior and resource reuse, not a guaranteed 60 FPS hardware benchmark. Large screens, GPU capability, shadow quality and patient load affect actual frame rate. GLBs total about 8.3 MB before transport compression and are bundled locally with Three.js and fonts. The first load therefore includes model download and GPU upload.

The scene is illustrative, with a maximum of 88 displayed people including staff and 180 specimen tokens. All queue totals and linked records still use the full simulation data. Local hospital dimensions, routes and transport calibration remain separate from the visual upgrade.
