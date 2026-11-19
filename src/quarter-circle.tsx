import type { Color, Vec2 } from "./vnode.ts";

export type Quadrant = "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight";

export interface QuarterCircleProps {
  radius: number;
  quadrant: Quadrant;
  color: Color;
  pos?: Vec2;
  opacity?: number;
  id?: string;
  class?: string | readonly string[];
  action?: string;
  scriptevents?: boolean;
  "z-index"?: number;
}

const BRUSH = "file:///Media/Painter/Stencils/01-EllipseRound/Brush.tga";

// Offset of the full circle inside the clipping frame, per visible quarter
const OFFSET: Record<Quadrant, (r: number) => Vec2> = {
  TopLeft: () => [0, 0],
  TopRight: (r) => [-r, 0],
  BottomLeft: (r) => [0, r],
  BottomRight: (r) => [-r, r],
};

// Quarter of a circle for rounded quad corners: a frame of radius×radius clips a full circle brush
export function QuarterCircle({
  radius,
  quadrant,
  color,
  pos = [0, 0],
  opacity = 1,
  id,
  class: className,
  action,
  scriptevents = false,
  "z-index": zIndex,
}: QuarterCircleProps) {
  if (!(radius > 0)) throw new Error(`<QuarterCircle> radius must be positive, got ${radius}`);
  const offset = OFFSET[quadrant];
  if (!offset) throw new Error(`<QuarterCircle> has invalid quadrant ${JSON.stringify(quadrant)}`);
  return (
    <frame pos={pos} size={[radius, radius]} id={id} z-index={zIndex}>
      <quad
        pos={offset(radius)}
        size={[radius * 2, radius * 2]}
        image={BRUSH}
        modulatecolor={color}
        opacity={opacity}
        class={className}
        action={action}
        scriptevents={scriptevents}
      />
    </frame>
  );
}
