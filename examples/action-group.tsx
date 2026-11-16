import { useContext, render, type RenderOptions, type Vec2 } from "maniatsx";
import {
  client,
  ml,
  type Integer,
  type Real,
  type ClientHandler,
  type ClientRef,
} from "maniatsx/client";
import { CAnimManager, type CMlFrame, type CMlLabel } from "maniatsx/maniascript";
import { slot } from "maniatsx/theme";
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
const SLIDE_MS: Integer = 200;

// Everything the view needs from the logic: geometry, the toggle handler and the refs the animation targets.
export interface ActionGroupViewProps {
  actions: readonly ActionButton[];
  closedX: number;
  onToggle: ClientHandler;
  slider: ClientRef<CMlFrame>;
  icon: ClientRef<CMlLabel>;
}

// Port of action-group.hbs. Logic: the open/closed state and the slide animation, compiled to ManiaScript.
export function ActionGroup(props: ActionGroupProps) {
  const closedX: Real = -props.actions.length * SIZE;
  const open = client.state<boolean>(false, { persist: true });
  const slider = client.ref<CMlFrame>();
  const icon = client.ref<CMlLabel>();

  const onToggle = client.handler(() => {
    const ease = CAnimManager.EAnimManagerEasing.ExpInOut;
    if (open.value) {
      ml.AnimMgr!.Add(slider.control, `<frame pos='${closedX} 0' />`, SLIDE_MS, ease);
      ml.AnimMgr!.Add(icon.control, "<label rot='0' pos='2.6 -2.15' />", SLIDE_MS, ease);
    } else {
      ml.AnimMgr!.Add(slider.control, "<frame pos='0 0' />", SLIDE_MS, ease);
      ml.AnimMgr!.Add(icon.control, "<label rot='180' pos='2.25 -2.9' />", SLIDE_MS, ease);
    }
    open.value = !open.value;
  });

  return (
    <Widget id="action-group-widget" position={props.position ?? [-156, 85]}>
      <ActionGroupView
        actions={props.actions}
        closedX={closedX}
        onToggle={onToggle}
        slider={slider}
        icon={icon}
      />
    </Widget>
  );
}

// A skin replaces this view and must attach all three client values: onToggle, slider and icon.
function DefaultActionGroupView(props: ActionGroupViewProps) {
  const theme = useContext(Theme);
  const count = props.actions.length;
  const width = (count + 1) * SIZE;
  return (
    <frame pos={[0, 0]} size={[width, SIZE]} z-index={10}>
      <frame ref={props.slider} size={[width, SIZE]} pos={[props.closedX, 0]}>
        <frame pos={[count * SIZE, 0]} size={[SIZE, SIZE]}>
          <quad size={[SIZE, SIZE]} bgcolor={theme.quad.background} />
          {/* U+F105 is the chevron glyph of the in-game icon font */}
          <label
            ref={props.icon}
            pos={[2.6, -2.15]}
            text={""}
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
          onClick={props.onToggle}
          pos={[count * SIZE, 0]}
          z-index={2}
          size={[SIZE, SIZE]}
          bgcolor={theme.quad.background}
          opacity={0}
        />
      </frame>
    </frame>
  );
}

// Swappable view: a theme can override this slot (see maniatsx/theme)
export const ActionGroupView = slot<ActionGroupViewProps>(
  "example/action-group",
  DefaultActionGroupView,
);

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
