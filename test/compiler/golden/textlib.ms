#Include "TextLib" as TextLib

{
  declare Text s = "hello";
  declare Text up = TextLib::ToUpperCase(s);
  declare Integer len = TextLib::Length(up);
  log(up ^ " " ^ len);
}
