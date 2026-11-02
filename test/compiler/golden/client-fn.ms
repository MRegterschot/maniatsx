Integer Mtx_F_client_fn_fact(Integer _n) {
  if (_n <= 1) {
    return 1;
  }
  return _n * Mtx_F_client_fn_fact(_n - 1);
}

Real Mtx_F_client_fn_scale(Real _x, Real _by) {
  return _x * _by;
}

Text Mtx_F_client_fn_greet(Text _who, Integer _times) {
  declare Text out = "";
  for (i, 0, _times - 1) {
    out ^= _who;
  }
  return out;
}

log("" ^ Mtx_F_client_fn_fact(5));
log("" ^ Mtx_F_client_fn_scale(1.5, 2.));
log(Mtx_F_client_fn_greet("hi", 2));
