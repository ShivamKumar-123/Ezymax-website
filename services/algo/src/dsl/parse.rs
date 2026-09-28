//! Lexer and parser for the Kalks strategy DSL (Python-like expressions, see `dsl/mod.rs` for the
//! language reference and limits). The parser only builds an expression tree: there are no loops, no
//! function definitions, no imports and no attribute access, so a program cannot do anything except
//! compute series from the bars it is given.

use std::fmt;

pub const MAX_SOURCE: usize = 20_000;
pub const MAX_STATEMENTS: usize = 200;
pub const MAX_DEPTH: usize = 48;
pub const MAX_IDENT: usize = 40;

#[derive(Clone, Debug, PartialEq)]
pub enum Tok {
    Num(f64),
    Str(String),
    Ident(String),
    Op(&'static str),
    Newline,
    Eof,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub tok: Tok,
    pub line: usize,
    pub col: usize,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct DslError {
    pub line: usize,
    pub col: usize,
    pub message: String,
}

impl fmt::Display for DslError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "line {}, col {}: {}", self.line, self.col, self.message)
    }
}

pub fn err<T>(line: usize, col: usize, message: impl Into<String>) -> Result<T, DslError> {
    Err(DslError { line, col, message: message.into() })
}

const OPS: [&str; 20] = ["<=", ">=", "==", "!=", "(", ")", "[", "]", ",", "=", "+", "-", "*", "/", "%", "<", ">", ";", ":", "."];

pub fn lex(src: &str) -> Result<Vec<Token>, DslError> {
    if src.len() > MAX_SOURCE {
        return err(1, 1, format!("program is too long ({} characters, max {MAX_SOURCE})", src.len()));
    }
    let chars: Vec<char> = src.chars().collect();
    let (mut i, mut line, mut col) = (0usize, 1usize, 1usize);
    let mut out = vec![];
    let mut depth = 0i32;
    while i < chars.len() {
        let c = chars[i];
        let (l0, c0) = (line, col);
        let adv = |i: &mut usize, col: &mut usize, n: usize| {
            *i += n;
            *col += n;
        };
        if c == '\n' {
            if depth == 0 {
                out.push(Token { tok: Tok::Newline, line, col });
            }
            i += 1;
            line += 1;
            col = 1;
            continue;
        }
        if c == ' ' || c == '\t' || c == '\r' {
            adv(&mut i, &mut col, 1);
            continue;
        }
        if c == '\\' && chars.get(i + 1) == Some(&'\n') {
            i += 2;
            line += 1;
            col = 1;
            continue;
        }
        if c == '#' {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }
        if c.is_ascii_digit() || (c == '.' && chars.get(i + 1).is_some_and(|d| d.is_ascii_digit())) {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.' || chars[i] == '_') {
                i += 1;
            }
            if i < chars.len() && (chars[i] == 'e' || chars[i] == 'E') {
                i += 1;
                if i < chars.len() && (chars[i] == '+' || chars[i] == '-') {
                    i += 1;
                }
                while i < chars.len() && chars[i].is_ascii_digit() {
                    i += 1;
                }
            }
            let text: String = chars[start..i].iter().filter(|c| **c != '_').collect();
            col += i - start;
            match text.parse::<f64>() {
                Ok(v) if v.is_finite() => out.push(Token { tok: Tok::Num(v), line: l0, col: c0 }),
                _ => return err(l0, c0, format!("invalid number \"{text}\"")),
            }
            continue;
        }
        if c.is_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let text: String = chars[start..i].iter().collect();
            col += i - start;
            if text.len() > MAX_IDENT {
                return err(l0, c0, format!("name is too long (max {MAX_IDENT} characters)"));
            }
            out.push(Token { tok: Tok::Ident(text), line: l0, col: c0 });
            continue;
        }
        if c == '"' || c == '\'' {
            let q = c;
            i += 1;
            col += 1;
            let mut s = String::new();
            loop {
                match chars.get(i) {
                    None | Some('\n') => return err(l0, c0, "unterminated string"),
                    Some(ch) if *ch == q => {
                        i += 1;
                        col += 1;
                        break;
                    }
                    Some(ch) => {
                        if s.len() > 200 {
                            return err(l0, c0, "string is too long (max 200 characters)");
                        }
                        s.push(*ch);
                        i += 1;
                        col += 1;
                    }
                }
            }
            out.push(Token { tok: Tok::Str(s), line: l0, col: c0 });
            continue;
        }
        let two: String = chars[i..(i + 2).min(chars.len())].iter().collect();
        if let Some(op) = OPS.iter().find(|o| o.len() == 2 && **o == two) {
            out.push(Token { tok: Tok::Op(op), line: l0, col: c0 });
            adv(&mut i, &mut col, 2);
            continue;
        }
        if let Some(op) = OPS.iter().find(|o| o.len() == 1 && o.starts_with(c)) {
            match *op {
                "(" | "[" => depth += 1,
                ")" | "]" => depth -= 1,
                _ => {}
            }
            if *op == ";" {
                out.push(Token { tok: Tok::Newline, line: l0, col: c0 });
            } else {
                out.push(Token { tok: Tok::Op(op), line: l0, col: c0 });
            }
            adv(&mut i, &mut col, 1);
            continue;
        }
        return err(l0, c0, format!("unexpected character '{c}'"));
    }
    out.push(Token { tok: Tok::Newline, line, col });
    out.push(Token { tok: Tok::Eof, line, col });
    Ok(out)
}

#[derive(Clone, Debug, PartialEq)]
pub enum Expr {
    Num(f64),
    Str(String),
    Ident(String, usize, usize),
    Neg(Box<Expr>),
    Not(Box<Expr>),
    Bin(&'static str, Box<Expr>, Box<Expr>),
    /// `a if cond else b`
    Cond(Box<Expr>, Box<Expr>, Box<Expr>),
    /// `x[n]`: value n bars ago
    Index(Box<Expr>, usize),
    Call(String, Vec<Expr>, Vec<(String, Expr)>, usize, usize),
}

impl Expr {
    pub fn nodes(&self) -> usize {
        match self {
            Expr::Num(_) | Expr::Str(_) | Expr::Ident(..) => 1,
            Expr::Neg(a) | Expr::Not(a) | Expr::Index(a, _) => 1 + a.nodes(),
            Expr::Bin(_, a, b) => 1 + a.nodes() + b.nodes(),
            Expr::Cond(a, b, c) => 1 + a.nodes() + b.nodes() + c.nodes(),
            Expr::Call(_, args, kw, _, _) => 1 + args.iter().map(Expr::nodes).sum::<usize>() + kw.iter().map(|(_, e)| e.nodes()).sum::<usize>(),
        }
    }

    /// Canonical text (memoisation key and the code view of a visual strategy).
    pub fn text(&self) -> String {
        match self {
            Expr::Num(v) => crate::spec::trim_num(*v),
            Expr::Str(s) => format!("\"{s}\""),
            Expr::Ident(s, ..) => s.clone(),
            Expr::Neg(a) => format!("-{}", a.text_atom()),
            Expr::Not(a) => format!("not {}", a.text_atom()),
            Expr::Bin(op, a, b) => format!("{} {op} {}", a.text_atom(), b.text_atom()),
            Expr::Cond(a, c, b) => format!("({} if {} else {})", a.text(), c.text(), b.text()),
            Expr::Index(a, n) => format!("{}[{n}]", a.text_atom()),
            Expr::Call(name, args, kw, _, _) => {
                let mut parts: Vec<String> = args.iter().map(Expr::text).collect();
                parts.extend(kw.iter().map(|(k, v)| format!("{k}={}", v.text())));
                format!("{name}({})", parts.join(", "))
            }
        }
    }

    fn text_atom(&self) -> String {
        match self {
            Expr::Bin(..) | Expr::Cond(..) | Expr::Not(..) => format!("({})", self.text()),
            _ => self.text(),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum Stmt {
    Assign(String, Expr, usize, usize),
    Call(String, Vec<Expr>, Vec<(String, Expr)>, usize, usize),
}

pub struct Parser {
    toks: Vec<Token>,
    pos: usize,
    depth: usize,
}

const KEYWORDS: [&str; 10] = ["and", "or", "not", "if", "else", "True", "False", "true", "false", "None"];
const FORBIDDEN: [&str; 16] = ["import", "def", "lambda", "for", "while", "class", "return", "exec", "eval", "print", "yield", "global", "with", "try", "del", "from"];

impl Parser {
    pub fn new(toks: Vec<Token>) -> Self {
        Self { toks, pos: 0, depth: 0 }
    }

    fn peek(&self) -> &Token {
        &self.toks[self.pos.min(self.toks.len() - 1)]
    }
    fn next(&mut self) -> Token {
        let t = self.peek().clone();
        if self.pos < self.toks.len() - 1 {
            self.pos += 1;
        }
        t
    }
    fn is_op(&self, op: &str) -> bool {
        matches!(&self.peek().tok, Tok::Op(o) if *o == op)
    }
    fn is_kw(&self, kw: &str) -> bool {
        matches!(&self.peek().tok, Tok::Ident(s) if s == kw)
    }
    fn expect_op(&mut self, op: &str) -> Result<(), DslError> {
        if self.is_op(op) {
            self.next();
            Ok(())
        } else {
            let t = self.peek().clone();
            err(t.line, t.col, format!("expected '{op}' but found {}", show(&t.tok)))
        }
    }

    pub fn program(&mut self) -> Result<Vec<Stmt>, DslError> {
        let mut out = vec![];
        loop {
            while self.peek().tok == Tok::Newline {
                self.next();
            }
            if self.peek().tok == Tok::Eof {
                break;
            }
            if out.len() >= MAX_STATEMENTS {
                let t = self.peek();
                return err(t.line, t.col, format!("too many statements (max {MAX_STATEMENTS})"));
            }
            out.push(self.statement()?);
            let t = self.peek().clone();
            if t.tok != Tok::Newline && t.tok != Tok::Eof {
                return err(t.line, t.col, format!("unexpected {} after the statement", show(&t.tok)));
            }
        }
        Ok(out)
    }

    fn statement(&mut self) -> Result<Stmt, DslError> {
        let t = self.next();
        let Tok::Ident(name) = t.tok.clone() else {
            return err(t.line, t.col, format!("a statement starts with a name, found {}", show(&t.tok)));
        };
        if FORBIDDEN.contains(&name.as_str()) {
            return err(t.line, t.col, format!("'{name}' is not supported: the strategy language has no loops, functions or imports"));
        }
        if KEYWORDS.contains(&name.as_str()) {
            return err(t.line, t.col, format!("'{name}' cannot start a statement"));
        }
        if self.is_op("=") {
            self.next();
            let e = self.expr()?;
            return Ok(Stmt::Assign(name, e, t.line, t.col));
        }
        if self.is_op("(") {
            let (args, kw) = self.args()?;
            return Ok(Stmt::Call(name, args, kw, t.line, t.col));
        }
        if self.is_op(".") {
            return err(t.line, t.col, "attribute access is not supported");
        }
        let n = self.peek().clone();
        err(n.line, n.col, format!("expected '=' or '(' after '{name}'"))
    }

    fn args(&mut self) -> Result<(Vec<Expr>, Vec<(String, Expr)>), DslError> {
        self.expect_op("(")?;
        let mut args = vec![];
        let mut kw: Vec<(String, Expr)> = vec![];
        if self.is_op(")") {
            self.next();
            return Ok((args, kw));
        }
        loop {
            // keyword argument?
            let is_kw = matches!(&self.peek().tok, Tok::Ident(_)) && matches!(self.toks.get(self.pos + 1).map(|t| &t.tok), Some(Tok::Op("=")));
            if is_kw {
                let t = self.next();
                let Tok::Ident(k) = t.tok else { unreachable!() };
                self.next();
                if kw.iter().any(|(x, _)| *x == k) {
                    return err(t.line, t.col, format!("argument '{k}' given twice"));
                }
                kw.push((k, self.expr()?));
            } else {
                if !kw.is_empty() {
                    let t = self.peek();
                    return err(t.line, t.col, "positional argument after a keyword argument");
                }
                args.push(self.expr()?);
            }
            if self.is_op(",") {
                self.next();
                if self.is_op(")") {
                    self.next();
                    break;
                }
                continue;
            }
            self.expect_op(")")?;
            break;
        }
        if args.len() + kw.len() > 8 {
            let t = self.peek();
            return err(t.line, t.col, "too many arguments");
        }
        Ok((args, kw))
    }

    fn enter(&mut self) -> Result<(), DslError> {
        self.depth += 1;
        if self.depth > MAX_DEPTH {
            let t = self.peek();
            return err(t.line, t.col, format!("expression is nested too deeply (max {MAX_DEPTH})"));
        }
        Ok(())
    }

    pub fn expr(&mut self) -> Result<Expr, DslError> {
        self.enter()?;
        let a = self.or_expr()?;
        let r = if self.is_kw("if") {
            self.next();
            let c = self.or_expr()?;
            if !self.is_kw("else") {
                let t = self.peek();
                return err(t.line, t.col, "expected 'else' in a conditional expression");
            }
            self.next();
            let b = self.expr()?;
            Expr::Cond(Box::new(a), Box::new(c), Box::new(b))
        } else {
            a
        };
        self.depth -= 1;
        Ok(r)
    }

    fn or_expr(&mut self) -> Result<Expr, DslError> {
        let mut a = self.and_expr()?;
        while self.is_kw("or") {
            self.next();
            let b = self.and_expr()?;
            a = Expr::Bin("or", Box::new(a), Box::new(b));
        }
        Ok(a)
    }
    fn and_expr(&mut self) -> Result<Expr, DslError> {
        let mut a = self.not_expr()?;
        while self.is_kw("and") {
            self.next();
            let b = self.not_expr()?;
            a = Expr::Bin("and", Box::new(a), Box::new(b));
        }
        Ok(a)
    }
    fn not_expr(&mut self) -> Result<Expr, DslError> {
        if self.is_kw("not") {
            self.next();
            self.enter()?;
            let e = self.not_expr()?;
            self.depth -= 1;
            return Ok(Expr::Not(Box::new(e)));
        }
        self.comparison()
    }
    fn comparison(&mut self) -> Result<Expr, DslError> {
        let a = self.additive()?;
        for op in ["<=", ">=", "==", "!=", "<", ">"] {
            if self.is_op(op) {
                self.next();
                let b = self.additive()?;
                for op2 in ["<=", ">=", "==", "!=", "<", ">"] {
                    if self.is_op(op2) {
                        let t = self.peek();
                        return err(t.line, t.col, "chained comparisons are not supported: use 'and'");
                    }
                }
                let op: &'static str = match op {
                    "<=" => "<=",
                    ">=" => ">=",
                    "==" => "==",
                    "!=" => "!=",
                    "<" => "<",
                    _ => ">",
                };
                return Ok(Expr::Bin(op, Box::new(a), Box::new(b)));
            }
        }
        Ok(a)
    }
    fn additive(&mut self) -> Result<Expr, DslError> {
        let mut a = self.term()?;
        loop {
            let op = if self.is_op("+") { "+" } else if self.is_op("-") { "-" } else { break };
            self.next();
            let b = self.term()?;
            a = Expr::Bin(op, Box::new(a), Box::new(b));
        }
        Ok(a)
    }
    fn term(&mut self) -> Result<Expr, DslError> {
        let mut a = self.unary()?;
        loop {
            let op = if self.is_op("*") { "*" } else if self.is_op("/") { "/" } else if self.is_op("%") { "%" } else { break };
            self.next();
            let b = self.unary()?;
            a = Expr::Bin(op, Box::new(a), Box::new(b));
        }
        Ok(a)
    }
    fn unary(&mut self) -> Result<Expr, DslError> {
        if self.is_op("-") {
            self.next();
            self.enter()?;
            let e = self.unary()?;
            self.depth -= 1;
            return Ok(match e {
                Expr::Num(v) => Expr::Num(-v),
                e => Expr::Neg(Box::new(e)),
            });
        }
        if self.is_op("+") {
            self.next();
            return self.unary();
        }
        self.postfix()
    }
    fn postfix(&mut self) -> Result<Expr, DslError> {
        let mut e = self.primary()?;
        while self.is_op("[") {
            let t = self.next();
            let n = self.next();
            let Tok::Num(v) = n.tok else {
                return err(n.line, n.col, "a history index must be a whole number, e.g. close[1]");
            };
            if v.fract() != 0.0 || !(0.0..=1000.0).contains(&v) {
                return err(n.line, n.col, "history index must be a whole number from 0 to 1000");
            }
            self.expect_op("]")?;
            let _ = t;
            e = Expr::Index(Box::new(e), v as usize);
        }
        if self.is_op(".") {
            let t = self.peek();
            return err(t.line, t.col, "attribute access is not supported");
        }
        Ok(e)
    }
    fn primary(&mut self) -> Result<Expr, DslError> {
        let t = self.next();
        match t.tok {
            Tok::Num(v) => Ok(Expr::Num(v)),
            Tok::Str(s) => Ok(Expr::Str(s)),
            Tok::Op("(") => {
                let e = self.expr()?;
                self.expect_op(")")?;
                Ok(e)
            }
            Tok::Ident(name) => {
                match name.as_str() {
                    "True" | "true" => return Ok(Expr::Num(1.0)),
                    "False" | "false" => return Ok(Expr::Num(0.0)),
                    _ => {}
                }
                if FORBIDDEN.contains(&name.as_str()) || name.starts_with("__") {
                    return err(t.line, t.col, format!("'{name}' is not supported in the strategy language"));
                }
                if KEYWORDS.contains(&name.as_str()) {
                    return err(t.line, t.col, format!("unexpected '{name}'"));
                }
                if self.is_op("(") {
                    let (args, kw) = self.args()?;
                    return Ok(Expr::Call(name, args, kw, t.line, t.col));
                }
                Ok(Expr::Ident(name, t.line, t.col))
            }
            other => err(t.line, t.col, format!("unexpected {}", show(&other))),
        }
    }
}

pub fn show(t: &Tok) -> String {
    match t {
        Tok::Num(v) => format!("number {v}"),
        Tok::Str(s) => format!("string \"{s}\""),
        Tok::Ident(s) => format!("'{s}'"),
        Tok::Op(o) => format!("'{o}'"),
        Tok::Newline => "end of line".into(),
        Tok::Eof => "end of program".into(),
    }
}

pub fn parse(src: &str) -> Result<Vec<Stmt>, DslError> {
    Parser::new(lex(src)?).program()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_expressions() {
        let p = parse("fast = ema(close, 20)\nbuy = crosses_above(fast, ema(close, 50)) and rsi(close, 14) < 70 # comment\n").unwrap();
        assert_eq!(p.len(), 2);
        let Stmt::Assign(_, e, ..) = &p[1] else { panic!() };
        assert_eq!(e.text(), "crosses_above(fast, ema(close, 50)) and (rsi(close, 14) < 70)");
        let p = parse("x = (1 if close > open else -1) * 2; y = close[1]").unwrap();
        assert_eq!(p.len(), 2);
        let p = parse("stop_loss(pips=20)\nsession(\"08:00\", \"17:00\")").unwrap();
        assert!(matches!(&p[0], Stmt::Call(n, a, k, ..) if n == "stop_loss" && a.is_empty() && k.len() == 1));
        // multi-line call inside parentheses
        assert!(parse("buy = (close > open and\n  close > close[1])").is_ok());
    }

    #[test]
    fn rejects_unsafe_or_bad_syntax() {
        for bad in ["import os", "def f(): 1", "x = __import__(\"os\")", "x = a.b", "while true: x = 1", "x = 1 < 2 < 3", "x = close[-1]", "x = close[1.5]", "for i in range(3): x=1", "x = lambda: 1", "x = \"unterminated"] {
            assert!(parse(bad).is_err(), "{bad} should fail");
        }
        let deep = format!("x = {}1{}", "(".repeat(100), ")".repeat(100));
        assert!(parse(&deep).unwrap_err().message.contains("nested too deeply"));
        assert!(parse(&"x".repeat(MAX_SOURCE + 1)).is_err());
        let many: String = (0..=MAX_STATEMENTS).map(|i| format!("v{i} = 1\n")).collect();
        assert!(parse(&many).unwrap_err().message.contains("too many statements"));
        let e = parse("x = 1\ny = )").unwrap_err();
        assert_eq!(e.line, 2);
    }
}
