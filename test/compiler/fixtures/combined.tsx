import { client, type Integer, type Text } from "maniatsx/client";
import { TextLib } from "maniatsx/maniascript";

interface Entry {
  name: Text;
  score: Integer;
}

export function Combined() {
  return (
    <quad
      size={[20, 8]}
      onClick={client.handler(() => {
        const entries: Entry[] = [{ name: "ann", score: 3 }];
        entries.push({ name: "bob", score: 9 });
        const best: Integer = entries.length > 1 ? entries[1]!.score : 0;
        const names: Text[] = [];
        for (const entry of entries) {
          if (!names.includes(entry.name)) {
            names.push(TextLib.ToUpperCase(entry.name));
          }
        }
        console.log(names.length + " names, best " + best);
      })}
    />
  );
}
