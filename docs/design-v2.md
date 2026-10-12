# LabFlow 2 — blue clinical control room

Brief: futurist blue interface; more realistic 3D built with Blender; visibly smooth motion. Keep the clinical workflow semantics and identifiers already agreed with the user.

Palette: Abyss #071223 (page); Control blue #0d1f37 (panels); Instrument blue #14344f (elevated controls); Electric cyan #49dcff (action/selection); Ice #eaf6ff (primary text); Signal amber #ffca74 (queues). Status rose #ff8298 is reserved for held/error states.

Typography: Noto Sans Thai, locally served. Thai headings 25–30px, UI text 12–14px, data 25px with tabular figures. Readable contrast throughout; no decorative microtype. Left-aligned operational content.

Layout: compact control-room header and navigation, a large scene stage with quiet instrumentation framing, linked detail panel to the right, workflow timeline and simulation transport controls nearby. Scene is the focal point; results and settings use the same blue hierarchy with dense but readable rows.

    [ LabFlow / facility                         Help ]
    [ nav ] [ Title + simulation clock              ]
    [     ] [ six live measures                     ]
    [     ] [ controls                               ]
    [     ] [ realistic laboratory   ][ trace panel ]
    [     ] [ incident controls      ][             ]
    [     ] [ event timeline                         ]

3D: authored Blender GLB geometry, bevels and coherent clinical proportions, PBR surfaces, environment lighting, soft shadows, subtle blue floor/cabinet accents. Keep a legible cutaway, without a roof hiding work. No external commercial machine branding. Editable .blend masters and build script retained.

Motion: continuous requestAnimationFrame rendering; simulation remains deterministic and independent. Smooth waypoint walking, articulated gait, specimen transitions, carrier tangent orientation, damped camera transitions, object pooling and instancing. Heavy UI updates run at lower frequency. Respect pause and reduced motion, bound scene population and render resolution, and offer quality settings.

Review against brief: the blue theme is explicitly requested, so use cyan as functional feedback rather than adding unrelated neon decoration. The clinical room and live workflow are the distinctive center. Remove tiny low-contrast labels and fix jumpy position changes instead of relying on decorative animation. Include actual Blender outputs, not a claim based on Three.js primitives.
