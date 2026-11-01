import { useContext, render, Script, type Node, type RenderOptions, type Vec2 } from "maniatsx";
import { HideWhileDriving } from "./hide-while-driving.tsx";
import { Page } from "./page.tsx";
import { DEFAULT_THEME, Theme } from "./theme.ts";

export interface WidgetProps {
  id: string;
  position: Vec2;
  hideWhileDriving?: boolean;
  children?: Node;
}

// Port of widget.hbs: a hidden frame revealed 300 ms after load. Hide logic merges into the single page script.
export function Widget(props: WidgetProps) {
  return (
    <Page id={props.id}>
      <Script.Globals>{"declare CMlFrame widget;"}</Script.Globals>
      <Script.Main>{`
        widget <=> (Page.MainFrame.GetFirstChild("widget") as CMlFrame);

        sleep(300);
        widget.Show();
      `}</Script.Main>
      <frame id="widget" pos={props.position} z-index={10} hidden>
        {props.children}
      </frame>
      {/* After the children so its loop call runs last, as in widget.hbs */}
      {props.hideWhileDriving && <HideWhileDriving target="widget" />}
    </Page>
  );
}

function LastTime(props: { millis: number }) {
  const theme = useContext(Theme);
  return (
    <>
      <quad size={[40, 10]} bgcolor={theme.quad.background} />
      <label
        pos={[20, -5]}
        text={props.millis}
        textprefix="Last: "
        halign="center"
        valign="center"
        textsize={2}
        textcolor={theme.label.foreground}
      />
    </>
  );
}

export function renderWidget(options?: RenderOptions): string {
  return render(
    <Theme.Provider value={DEFAULT_THEME}>
      <Widget id="example-widget" position={[120, 80]} hideWhileDriving>
        <LastTime millis={52341} />
      </Widget>
    </Theme.Provider>,
    options,
  );
}
