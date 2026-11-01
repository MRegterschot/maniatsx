// Render benchmark: a ~200-element window with a 40-row list. Run with `bun run bench`.
import { Manialink, Script, createContext, ms, render, useContext } from "../src/index.ts";

const WARMUP = 200;
const RUNS = 2000;
const ROWS = 40;

const THEME = { bg: "1a1a1acc", alt: "2a2a2acc", fg: "ffffff", accent: "0af" };
const Theme = createContext(THEME);

interface RowProps {
  index: number;
  name: string;
  score: number;
}

function Row(props: RowProps) {
  const theme = useContext(Theme);
  return (
    <frame pos={[0, -6 - props.index * 4]} z-index={1}>
      <Script.Functions id="row-helpers">{ms`
        Void Flash(Text Id) {
          Page.GetFirstChild(Id).Show();
        }
      `}</Script.Functions>
      <quad size={[100, 3.5]} bgcolor={props.index % 2 ? theme.alt : theme.bg} />
      <label
        pos={[2, -1.75]}
        size={[70, 3]}
        text={props.name}
        textcolor={theme.fg}
        valign="center"
      />
      <label
        pos={[80, -1.75]}
        size={[18, 3]}
        halign="right"
        valign="center"
        text={String(props.score)}
        textcolor={theme.accent}
      />
      <frame pos={[95, -0.5]} size={[4, 2.5]} class={["row-actions"]} />
    </frame>
  );
}

function Window(props: { title: string; rows: RowProps[] }) {
  return (
    <frame pos={[-50, 40]} size={[100, 80]} z-index={20}>
      <quad size={[100, 5]} bgcolor="000000cc" />
      <label
        pos={[2, -2.5]}
        size={[96, 4]}
        text={props.title}
        textfont="GameFontSemiBold"
        valign="center"
      />
      <frame pos={[0, -5]}>
        {props.rows.map((row) => (
          <Row key={row.index} {...row} />
        ))}
      </frame>
      <Script.Include lib="MathLib" as="ML" />
      <Script.Events>{ms`
        if (Event.Type == CMlScriptEvent::Type::MouseClick && Event.ControlId == ${"row-close"}) {
          TriggerPageAction(${"close"});
        }
      `}</Script.Events>
    </frame>
  );
}

const rows: RowProps[] = Array.from({ length: ROWS }, (_, index) => ({
  index,
  name: `Player ${index + 1}`,
  score: 10000 - index * 137,
}));

// Built on every call, as the server does on each change.
function page() {
  return (
    <Theme.Provider value={THEME}>
      <Manialink id="bench-window" name="TMCP:bench">
        <Window title="Leaderboard" rows={rows} />
      </Manialink>
    </Theme.Provider>
  );
}

const renderPage = () =>
  render(page(), {
    onWarning: (m) => {
      throw new Error(m);
    },
  });

for (let i = 0; i < WARMUP; i++) renderPage();

const times: number[] = [];
let xml = "";
for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  xml = renderPage();
  times.push(performance.now() - start);
}

times.sort((a, b) => a - b);
const mean = times.reduce((sum, t) => sum + t, 0) / RUNS;
const p95 = times[Math.ceil(RUNS * 0.95) - 1]!;
const bytes = new TextEncoder().encode(xml).byteLength;
const elements = xml.match(/<[A-Za-z]/g)?.length ?? 0;

console.log(`elements: ${elements}, output: ${bytes} bytes (compact)`);
console.log(`runs: ${RUNS} after ${WARMUP} warm-up renders`);
console.log(`mean: ${mean.toFixed(3)} ms per render`);
console.log(`p95:  ${p95.toFixed(3)} ms per render`);
