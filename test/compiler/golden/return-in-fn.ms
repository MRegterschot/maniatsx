Integer Mtx_F_return_in_fn_clamp(Integer _value, Integer _max) {
  if (_value > _max) {
    return _max;
  }
  return _value;
}

log("" ^ Mtx_F_return_in_fn_clamp(12, 10));
