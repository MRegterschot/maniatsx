import { Anchored } from "maniatsx/theme";
import { kit, Label, Panel } from "./kit.tsx";

const records = [
  ["1", "Wirtual", "0:24.512"],
  ["2", "Scrapie", "0:24.689"],
  ["3", "Massa", "0:24.731"],
  ["4", "Gwen", "0:24.902"],
  ["5", "You", "0:25.118"],
] as const;

export function Records() {
  const t = kit.useTokens();
  return (
    <Anchored name="records" layout={{ anchor: "top-right", margin: [2, 14], size: [55, 28.5] }}>
      <Panel size={[55, 5]}>
        <Label
          pos={[2, -2.5]}
          size={[40, 4]}
          textsize={1.5}
          text={kit.useText("records.title", "Records")}
          style="title"
          valign="center"
        />
        <label
          pos={[53, -2.5]}
          size={[10, 4]}
          text="5"
          textsize={1}
          textfont={t.font.body}
          textcolor={t.color.textMuted}
          halign="right"
          valign="center"
        />
      </Panel>
      <Panel pos={[0, -5]} size={[55, 23.5]}>
        {records.map(([rank, name, time], index) => {
          // Rows are inside the body panel, which starts 5 below the widget top
          const y = 0.5 + index * 4.6;
          const local = index === 4;
          return (
            <>
              {index % 2 === 0 && (
                <quad pos={[0, -y]} size={[55, 4.6]} bgcolor={t.color.surfaceAlt} opacity={0.5} />
              )}
              {local && <quad pos={[0, -y]} size={[0.6, 4.6]} bgcolor={t.color.accent} />}
              <label
                pos={[2, -(y + 2.3)]}
                size={[4, 4.6]}
                text={rank}
                textsize={1}
                textfont={t.font.body}
                textcolor={t.color.textMuted}
                valign="center"
              />
              <label
                pos={[7, -(y + 2.3)]}
                size={[30, 4.6]}
                text={name}
                textsize={1}
                textfont={t.font.body}
                textcolor={local ? t.color.accent : t.color.text}
                valign="center"
              />
              <label
                pos={[53, -(y + 2.3)]}
                size={[20, 4.6]}
                text={time}
                textsize={1}
                textfont={t.font.title}
                textcolor={index === 0 ? t.color.accent : t.color.text}
                halign="right"
                valign="center"
              />
            </>
          );
        })}
      </Panel>
    </Anchored>
  );
}
