#![deny(clippy::all)]

use uroborosql_fmt::format_sql;

#[macro_use]
extern crate napi_derive;

#[napi]
pub fn runfmt(input: String) ->  String {
    format_sql(&input)
}
