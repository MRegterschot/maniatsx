import { useContext, render, type Node, type RenderOptions, type Vec2 } from "maniatsx";
import { Page } from "./page.tsx";
import { DEFAULT_THEME, Theme } from "./theme.ts";

export interface WindowProps {
  id: string;
  title: string;
  /** Content area size; the title bar adds 5 to the height. */
  size: Vec2;
  children?: Node;
}

// Port of window.hbs. The "close-window-<id>" page action is handled server-side.
export function Window(props: WindowProps) {
  const theme = useContext(Theme);
  const [width, height] = props.size;
  return (
    <Page id={props.id}>
      <frame id="window" pos={[-width / 2, height / 2]} size={[width, height + 5]} z-index={20}>
        <quad pos={[0, 0]} size={[width, 5]} bgcolor={theme.quad.background} />
        <label
          pos={[1.5, -2.25]}
          text={props.title}
          size={[width - 9.5, 5]}
          valign="center"
          halign="left"
          textsize={1}
          textcolor={theme.label.foreground}
          textfont="GameFontSemiBold"
        />
        {/* U+F00D is the "x" glyph of the in-game icon font */}
        <label
          pos={[width - 1.5, -2.25]}
          text={""}
          size={[5, 5]}
          valign="center"
          halign="right"
          textsize={1}
          textcolor={theme.label.background}
          action={`close-window-${props.id}`}
          focusareacolor2={`${theme.label.foreground}0`}
        />

        <quad pos={[0, -5]} size={[width, height]} bgcolor={theme.quad.foreground} />
        <frame pos={[0, -5]} size={[width, height]}>
          {props.children}
        </frame>
      </frame>
    </Page>
  );
}

function Greeting() {
  const theme = useContext(Theme);
  return (
    <label
      pos={[2, -3]}
      text="Hello, Trackmania!"
      textsize={2}
      textcolor={theme.label.background}
      textfont="GameFontRegular"
    />
  );
}

export function renderWindow(options?: RenderOptions): string {
  return render(
    <Theme.Provider value={DEFAULT_THEME}>
      <Window id="example-window" title="Example window" size={[100, 60]}>
        <Greeting />
      </Window>
    </Theme.Provider>,
    options,
  );
}
