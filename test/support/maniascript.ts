import { ManiaScriptLexer, ManiaScriptParser } from "@maniascript/parser";
import { CharStream, CommonTokenStream, BaseErrorListener } from "antlr4ng";

export function parseManiaScript(code: string): { errors: string[] } {
  const errors: string[] = [];
  const listener = new (class extends BaseErrorListener {
    override syntaxError(
      _recognizer: unknown,
      _symbol: unknown,
      line: number,
      column: number,
      message: string,
    ) {
      errors.push(`${line}:${column}: ${message}`);
    }
  })();
  const lexer = new ManiaScriptLexer(CharStream.fromString(code));
  lexer.setGame(ManiaScriptLexer.GAME_TRACKMANIA);
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new ManiaScriptParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  parser.program();
  errors.push(...gameQuirks(code));
  return { errors };
}

export function extractScripts(xml: string): string[] {
  return Array.from(
    xml.matchAll(/<script\b[^>]*>\s*<!--([\s\S]*?)-->\s*<\/script\s*>/g),
    (match) => match[1]!,
  );
}

// Rules the game enforces but @maniascript/parser doesn't
function gameQuirks(code: string): string[] {
  const lines = code.split("\n");
  let lastTopLevel = "";
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//") || /^\s/.test(raw)) continue;
    if (/^main\s*\(/.test(line) && /^declare\b/.test(lastTopLevel))
      return [
        `${i + 1}:0: game: syntax error, unexpected main (put a function between globals and main)`,
      ];
    lastTopLevel = line;
  }
  return [];
}
