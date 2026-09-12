# Camera choice — orbit

Bienenstock uses **orbit** (pointer drag + wheel), not a walk/FPS camera.

## Why orbit

- The subject is a fixed outdoor set-piece: a skep in a meadow. Visitors need to inspect the hive
  from several angles and distances, not traverse a large navigable space.
- Orbit works **without a keyboard** — drag to rotate, wheel to zoom — which matches the ticket
  requirement and works on trackpads and touch pointers.
- Polar angle is clamped so the camera cannot pass under the ground plane; zoom distance is
  clamped so the hive stays readable and the meadow does not disappear into fog.

A later issue that needs ground-level foraging paths can revisit walk controls; this ticket is a
static scene with a movable camera.
