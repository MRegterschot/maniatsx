import { Script, ms } from "maniatsx";

export interface HideWhileDrivingProps {
  /** Id of the frame to slide out of view while the player drives. */
  target: string;
  /** Speed in km/h above which the target hides. Default: 10. */
  speed?: number;
}

// Port of scripts/hide.hbs. Rendered N times it defines the functions once, so use one target per page.
export function HideWhileDriving(props: HideWhileDrivingProps) {
  const speed = props.speed ?? 10;
  return (
    <>
      <Script.Globals id="hide-while-driving">{`
        declare Vec2 HS_BasePosition;
        declare CMlFrame HS_Target;
        declare Boolean HS_Hidden;
      `}</Script.Globals>
      <Script.Functions id="hide-while-driving">{ms`
        Void hs_hide(Integer duration) {
          HS_Hidden = True;
          declare Real x;
          if (HS_BasePosition[0] < 0.0) {
            x = (HS_Target.Size[0] * -HS_Target.RelativeScale) - 322.0;
          } else {
            x = 322.0;
          }
          AnimMgr.Add(HS_Target, "<frame pos='" ^ x ^ " " ^ HS_BasePosition[1] ^ "' />", duration, CAnimManager::EAnimManagerEasing::ExpInOut);
        }

        Void hs_show(Integer duration) {
          HS_Hidden = False;
          AnimMgr.Add(HS_Target, "<frame pos='" ^ HS_BasePosition[0] ^ " " ^ HS_BasePosition[1] ^ "' />", duration, CAnimManager::EAnimManagerEasing::CircOut);
        }

        Void hidescript() {
          if (HS_Target == Null) {
            HS_Target <=> (Page.MainFrame.GetFirstChild(${props.target}) as CMlFrame);
            HS_BasePosition = HS_Target.AbsolutePosition_V3;
          }

          declare hideSpeed = ${ms.int(speed)};

          if (InputPlayer == Null) {
            if (HS_Hidden) {
              hs_show(600);
            }
            return;
          }

          declare Boolean overHidespeed = ML::Abs(InputPlayer.Speed * 3.6) > hideSpeed;

          if (overHidespeed && !HS_Hidden) {
            hs_hide(1000);

            while (InputPlayer.Speed * 3.6 > hideSpeed) {
              yield;
              hidescript();
            }
          }

          if (!overHidespeed && HS_Hidden) {
            sleep(1000);
            hs_show(600);
          }
        }
      `}</Script.Functions>
      <Script.Loop id="hide-while-driving">{"hidescript();"}</Script.Loop>
    </>
  );
}
