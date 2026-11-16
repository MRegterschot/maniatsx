import { client, ml, type Integer, type Real, type Vec2 } from "maniatsx/client";
import { CAnimManager, MathLib, type CMlFrame } from "maniatsx/maniascript";

export interface HideWhileDrivingProps {
  /** Id of the frame to slide out of view while the player drives. */
  target: string;
  /** Speed in km/h above which the target hides. Default: 10. */
  speed?: Real;
}

const SHOW_DELAY: Integer = 1000;

const slideTo = client.fn(
  (
    frame: CMlFrame,
    x: Real,
    y: Real,
    duration: Integer,
    easing: CAnimManager.EAnimManagerEasing,
  ): void => {
    ml.AnimMgr!.Add(frame, `<frame pos='${x} ${y}' />`, duration, easing);
  },
);

// Port of scripts/hide.hbs. Shows again SHOW_DELAY ms after dropping below the speed, without blocking the script.
export function HideWhileDriving(props: HideWhileDrivingProps) {
  const target = props.target;
  const hideSpeed: Real = props.speed ?? 10;

  const base = client.state<Vec2>({ X: 0, Y: 0 });
  const hidden = client.state<boolean>(false);
  const slowSince = client.state<Integer>(-1);

  client.onInit(() => {
    const frame = ml.Page!.MainFrame!.GetFirstChild(target) as CMlFrame;
    base.value = frame.RelativePosition_V3;
  });

  client.onFrame(() => {
    const frame = ml.Page!.MainFrame!.GetFirstChild(target) as CMlFrame;
    const player = ml.InputPlayer;

    if (player === null) {
      if (hidden.value) {
        hidden.value = false;

        slideTo(frame, base.value.X, base.value.Y, 600, CAnimManager.EAnimManagerEasing.CircOut);
      }
    } else if (MathLib.Abs(player.Speed * 3.6) > hideSpeed) {
      if (slowSince.value !== -1) slowSince.value = -1;

      if (!hidden.value) {
        hidden.value = true;

        let x: Real = 322;
        if (frame.AbsolutePosition_V3.X < 0) x = frame.Size.X * -frame.RelativeScale - 322;

        slideTo(frame, x, base.value.Y, 1000, CAnimManager.EAnimManagerEasing.ExpInOut);
      }
    } else if (hidden.value) {
      if (slowSince.value === -1) {
        slowSince.value = ml.Now;
      } else if (ml.Now - slowSince.value >= SHOW_DELAY) {
        hidden.value = false;
        slowSince.value = -1;

        slideTo(frame, base.value.X, base.value.Y, 600, CAnimManager.EAnimManagerEasing.CircOut);
      }
    }
  });

  return null;
}
