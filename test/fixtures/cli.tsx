import { Manialink } from "../../src/manialink.tsx";

export default function Fixture({ title = "Default" }: { title?: string }) {
  return (
    <Manialink id="fixture">
      <label text={title} />
    </Manialink>
  );
}

export const node = <Manialink id="named" />;
