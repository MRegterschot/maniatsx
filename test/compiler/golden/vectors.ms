{
  declare Real x = 3.;
  declare Integer n = 4;
  declare CMlLabel label <=> (Page.GetFirstChild("l") as CMlLabel);
  label.RelativePosition_V3 = <1., 2.>;
  declare Vec2 size = <x, 2.5>;
  declare Int2 cell = <1, n>;
  log(size.X ^ " " ^ cell.Y);
}
