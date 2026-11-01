import { describe, expect, test } from "bun:test";
import { ms } from "../src/ms.ts";
import { MS_CODE } from "../src/vnode.ts";

describe("numbers", () => {
  test("integers and non-integers", () => {
    expect(ms`${42}`.code).toBe("42");
    expect(ms`${-7}`.code).toBe("-7");
    expect(ms`${-0}`.code).toBe("0");
    expect(ms`${1.5}`.code).toBe("1.5");
    expect(ms`${0.1 + 0.2}`.code).toBe("0.30000000000000004");
  });

  test("never uses exponent notation", () => {
    expect(ms`${1e-7}`.code).toBe("0.0000001");
    expect(ms`${1.5e-10}`.code).toBe("0.00000000015");
    // Large whole numbers overflow Integer, so they must go through ms.real
    expect(ms`${ms.real(1e21)}`.code).toBe("1000000000000000000000.");
    expect(ms`${ms.real(-1.25e21)}`.code).toBe("-1250000000000000000000.");
  });

  test("non-finite throws and names the interpolation", () => {
    expect(() => ms`a ${1} ${NaN}`).toThrow(/interpolation 1.*finite/);
    expect(() => ms`${Infinity}`).toThrow(/interpolation 0/);
  });

  test("ms.real always has a dot", () => {
    expect(ms.real(1).code).toBe("1.");
    expect(ms.real(1.5).code).toBe("1.5");
    expect(ms.real(-0.25).code).toBe("-0.25");
    expect(ms.real(-0).code).toBe("0.");
    expect(ms.real(1e-7).code).toBe("0.0000001");
    expect(ms.real(1e21).code).toBe("1000000000000000000000.");
    expect(() => ms.real(NaN)).toThrow(/finite/);
  });

  test("ms.int requires an integer", () => {
    expect(ms.int(5).code).toBe("5");
    expect(() => ms.int(5.5)).toThrow(/integer/);
    expect(() => ms.int(Infinity)).toThrow();
  });

  test("ms.vec2 uses reals", () => {
    expect(ms.vec2(1, 2).code).toBe("<1., 2.>");
    expect(ms.vec2(-0.5, 3.25).code).toBe("<-0.5, 3.25>");
    expect(() => ms.vec2(1, NaN)).toThrow(/finite/);
  });
});

describe("strings and booleans", () => {
  test("quotes and escapes", () => {
    expect(ms`${"hi"}`.code).toBe('"hi"');
    expect(ms`${'a"b\\c'}`.code).toBe('"a\\"b\\\\c"');
    expect(ms`${"l1\nl2\r\tx"}`.code).toBe('"l1\\nl2\\r\\tx"');
  });

  test("injection attempts stay inside the literal", () => {
    expect(ms`x = ${'"; Quit(); //'};`.code).toBe('x = "\\"; Quit(); //";');
    expect(ms`x = ${'"""'};`.code).toBe('x = "\\"\\"\\"";');
    expect(ms`x = ${'\\"; Quit(); "'};`.code).toBe('x = "\\\\\\"; Quit(); \\"";');
    expect(ms`x = ${'a\n"b'};`.code).not.toContain("\n");
  });

  test("booleans", () => {
    expect(ms`${true} ${false}`.code).toBe("True False");
  });
});

describe("arrays, nesting and raw", () => {
  test("homogeneous arrays", () => {
    expect(ms`${[1, 2, 3]}`.code).toBe("[1, 2, 3]");
    expect(ms`${["a", 'b"']}`.code).toBe('["a", "b\\""]');
    expect(ms`${[ms.real(1), ms.real(2.5)]}`.code).toBe("[1., 2.5]");
    expect(ms`${[[1, 2], [3]]}`.code).toBe("[[1, 2], [3]]");
  });

  test("empty and mixed arrays throw", () => {
    expect(() => ms`${[]}`).toThrow(/empty array/);
    expect(() => ms`${[1, "a"] as any}`).toThrow(/mixes number and string/);
    expect(() => ms`${[1, [2]] as any}`).toThrow(/mixes/);
  });

  test("nested MsCode and raw are verbatim", () => {
    const inner = ms`Foo(${"a"})`;
    expect(ms`x = ${inner};`.code).toBe('x = Foo("a");');
    expect(ms`x = ${ms.raw('Raw("$")')};`.code).toBe('x = Raw("$");');
    expect(ms.raw("a\n  b").code).toBe("a\n  b");
  });

  test("results are frozen MsCode", () => {
    const code = ms`1`;
    expect(code.$$typeof).toBe(MS_CODE);
    expect(Object.isFrozen(code)).toBe(true);
  });

  test("null, undefined, objects and functions throw with the index", () => {
    expect(() => ms`${1} ${null as any}`).toThrow(/interpolation 1.*null/);
    expect(() => ms`${undefined as any}`).toThrow(/interpolation 0.*undefined/);
    expect(() => ms`${{} as any}`).toThrow(/interpolation 0.*object/);
    expect(() => ms`${(() => 1) as any}`).toThrow(/function/);
    expect(() => ms`${[1, null] as any}`).toThrow(/mixes/);
    expect(() => ms`${[{}, {}] as any}`).toThrow(/interpolation 0\[0\]/);
  });
});

describe("dedent", () => {
  test("strips indentation and blank edge lines", () => {
    const code = ms`
      if (a) {
        b();
      }
    `;
    expect(code.code).toBe("if (a) {\n  b();\n}");
  });

  test("handles interpolation at line start and blank lines inside", () => {
    const code = ms`
        a();

        ${ms`b();`}
          c(${1});
    `;
    expect(code.code).toBe("a();\n\nb();\n  c(1);");
  });

  test("dedents before interpolating, so multi-line values are untouched", () => {
    const inner = ms.raw("x();\n      y();");
    const code = ms`
      f() {
        ${inner}
      }
    `;
    expect(code.code).toBe("f() {\n  x();\n      y();\n}");
  });

  test("single-line templates are left alone", () => {
    expect(ms` a ${1} b `.code).toBe(" a 1 b ");
  });

  test("keeps ManiaScript escapes written in the source", () => {
    expect(ms`Log("a\n");`.code).toBe('Log("a\\n");');
  });
});

describe("lead fixes", () => {
  test("splits -- inside string literals", () => {
    expect(ms`${"a-->b"}`.code).toBe('"a-" ^ "->b"');
    expect(ms`${"---"}`.code).toBe('"-" ^ "-" ^ "-"');
  });
  test("accepts 64-bit-ish integers but rejects unsafe ones", () => {
    expect(ms`${2 ** 31}`.code).toBe("2147483648");
    expect(() => ms`${2 ** 53}`).toThrow(/safe Integer/);
  });
});
