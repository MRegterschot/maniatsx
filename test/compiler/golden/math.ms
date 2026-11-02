#Include "MathLib" as MathLib

{
  declare Integer i = -4;
  declare Real x = 2.5;
  declare Integer a = MathLib::Abs(i);
  declare Real b = MathLib::Abs(x);
  declare Integer lo = MathLib::Min(i, 3);
  declare Real hi = MathLib::Max(x, 1.5);
  declare Integer f = MathLib::FloorInteger(x);
  declare Integer rd = MathLib::NearestInteger(x);
  declare Integer c = MathLib::CeilingInteger(x);
  declare Real sq = MathLib::Sqrt(x);
  declare Real s = MathLib::Sin(x);
  declare Real co = MathLib::Cos(x);
  declare Real p = MathLib::Pow(x, 2.);
  declare Real pi = MathLib::Pi;
  log(a ^ " " ^ b ^ " " ^ lo ^ " " ^ hi ^ " " ^ f ^ " " ^ rd ^ " " ^ c ^ " " ^ sq ^ " " ^ s ^ " " ^ co ^ " " ^ p ^ " " ^ pi);
}
