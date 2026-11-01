import { useContext, render, Script, ms, type RenderOptions, type Vec2 } from "maniatsx";
import { Widget } from "./widget.tsx";
import { DEFAULT_THEME, Theme } from "./theme.ts";

export interface ActionButton {
  name: string;
  /** Image URL for type "image", otherwise the label text (an icon glyph). */
  icon: string;
  type?: "image" | "text";
  /** Page action sent to the server on click. */
  action?: string;
}

export interface ActionGroupProps {
  actions: readonly ActionButton[];
  /** Widget position. Default: top-left corner. */
  position?: Vec2;
}

const SIZE = 5;

// Port of action-group.hbs: an expandable button bar; the toggle animation lives in the page script.
export function ActionGroup(props: ActionGroupProps) {
  const theme = useContext(Theme);
  const count = props.actions.length;
  const width = (count + 1) * SIZE;
  const closedX = -count * SIZE;
  const anim = "CAnimManager::EAnimManagerEasing::ExpInOut";
  return (
    <Widget id="action-group-widget" position={props.position ?? [-156, 85]}>
      <Script.Main>{"declare Boolean actionGroupIsOpen = false for This;"}</Script.Main>
      <Script.Events>{ms`
        if (Event.Control.HasClass("trigger") && Event.Type == CMlScriptEvent::Type::MouseClick) {
          declare Boolean actionGroupIsOpen for This;

          if (actionGroupIsOpen) {
            AnimMgr.Add(Event.Control.Parent, """<frame pos='${closedX} 0' />""", 200, ${ms.raw(anim)});
            declare triggerIcon <=> ((Event.Control.Parent.Controls[0] as CMlFrame).Controls[1] as CMlLabel);
            AnimMgr.Add(triggerIcon, """<label rot='0' pos='2.6 -2.15' />""", 200, ${ms.raw(anim)});
          } else {
            AnimMgr.Add(Event.Control.Parent, """<frame pos='0 0' />""", 200, ${ms.raw(anim)});
            declare triggerIcon <=> ((Event.Control.Parent.Controls[0] as CMlFrame).Controls[1] as CMlLabel);
            AnimMgr.Add(triggerIcon, """<label rot='180' pos='2.25 -2.9' />""", 200, ${ms.raw(anim)});
          }

          actionGroupIsOpen = !actionGroupIsOpen;
        }
      `}</Script.Events>

      <frame pos={[0, 0]} size={[width, SIZE]} z-index={10}>
        <frame size={[width, SIZE]} pos={[closedX, 0]}>
          <frame pos={[count * SIZE, 0]} size={[SIZE, SIZE]}>
            <quad size={[SIZE, SIZE]} bgcolor={theme.quad.background} />
            {/* U+F105 is the chevron glyph of the in-game icon font */}
            <label
              pos={[2.6, -2.15]}
              text={""}
              halign="center"
              valign="center"
              textsize={2.5}
              textcolor={theme.label.foreground}
            />
          </frame>

          {props.actions.map((action, index) => (
            <frame pos={[index * SIZE, 0]} size={[SIZE, SIZE]}>
              <quad size={[SIZE, SIZE]} bgcolor={theme.quad.foreground} action={action.action} />
              {action.type === "image" ? (
                <quad image={action.icon} size={[3.5, 3.5]} pos={[0.75, -0.75]} />
              ) : (
                <label
                  pos={[2.5, -2.1]}
                  text={action.icon}
                  halign="center"
                  valign="center"
                  textsize={2}
                  textcolor={theme.label.background}
                />
              )}
            </frame>
          ))}

          <quad
            class="trigger"
            pos={[count * SIZE, 0]}
            z-index={2}
            size={[SIZE, SIZE]}
            bgcolor={theme.quad.background}
            opacity={0}
            scriptevents
          />
        </frame>
      </frame>
    </Widget>
  );
}

const SAMPLE_ACTIONS: ActionButton[] = [
  { name: "maps", icon: "https://example.com/icons/maps.png", type: "image", action: "open-maps" },
  { name: "players", icon: "", type: "text", action: "open-players" },
  { name: "settings", icon: "", type: "text", action: "open-settings" },
];

export function renderActionGroup(options?: RenderOptions): string {
  return render(
    <Theme.Provider value={DEFAULT_THEME}>
      <ActionGroup actions={SAMPLE_ACTIONS} />
    </Theme.Provider>,
    options,
  );
}
