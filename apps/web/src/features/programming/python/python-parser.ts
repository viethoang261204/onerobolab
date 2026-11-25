/*
 * A small, safe parser for the OneRoboLab Python dialect — the subset a
 * student writes in Code Studio:
 *
 *   robot.move_forward(120)          for _ in range(4):        def deliver():
 *   if robot.distance() < 30:        while not robot.on_line():   deliver()
 *   elif robot.color() == "red":     count += 1                 break / pass
 *
 * Source text → tokens (with INDENT / DEDENT) → a tiny AST. Nothing is ever
 * executed: `python-to-blocks.ts` turns the AST into the block program,
 * which the existing compiler turns into IR. Errors carry a line number and
 * a student-friendly message.
 */

import { messagesFor } from '../../i18n/i18n';
import { pythonErrorMessages } from '../programming.messages';

export class PythonError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'PythonError';
  }
}

type TokKind = 'name' | 'num' | 'str' | 'op' | 'newline' | 'indent' | 'dedent' | 'comment' | 'eof';

export interface Token {
  readonly kind: TokKind;
  readonly value: string;
  readonly line: number;
}

const OPS = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '(', ')', ',', ':', '.', '+', '-', '*', '/', '<', '>', '='] as const;
const KEYWORDS = new Set(['if', 'elif', 'else', 'while', 'for', 'in', 'def', 'break', 'pass', 'and', 'or', 'not', 'True', 'False', 'return', 'import', 'from', 'continue', 'lambda', 'class', 'try', 'with']);

/** Source → tokens. Whole-line comments become `comment` tokens (attached to the next statement). */
export function tokenize(source: string): Token[] {
  const err = messagesFor(pythonErrorMessages);
  const out: Token[] = [];
  const indents = [0];
  let depth = 0; // open brackets: newlines inside them are ignored
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const line = i + 1;
    let pos = 0;
    if (depth === 0) {
      let width = 0;
      while (pos < raw.length && (raw[pos] === ' ' || raw[pos] === '\t')) {
        width += raw[pos] === '\t' ? 4 : 1;
        pos++;
      }
      const rest = raw.slice(pos);
      if (rest.trim() === '') return;
      if (rest.startsWith('#')) {
        out.push({ kind: 'comment', value: rest.slice(1).trim(), line });
        return;
      }
      const top = indents[indents.length - 1]!;
      if (width > top) {
        indents.push(width);
        out.push({ kind: 'indent', value: '', line });
      } else if (width < top) {
        while (width < indents[indents.length - 1]!) {
          indents.pop();
          out.push({ kind: 'dedent', value: '', line });
        }
        if (width !== indents[indents.length - 1]) throw new PythonError(err.badIndent, line);
      }
    }
    while (pos < raw.length) {
      const ch = raw[pos]!;
      if (ch === ' ' || ch === '\t') {
        pos++;
        continue;
      }
      if (ch === '#') break;
      const rest = raw.slice(pos);
      const num = /^(\d+\.?\d*|\.\d+)/.exec(rest);
      if (num) {
        out.push({ kind: 'num', value: num[1]!, line });
        pos += num[1]!.length;
        continue;
      }
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      if (name) {
        out.push({ kind: 'name', value: name[0], line });
        pos += name[0].length;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const end = raw.indexOf(ch, pos + 1);
        if (end < 0) throw new PythonError(err.missingQuote, line);
        out.push({ kind: 'str', value: raw.slice(pos + 1, end), line });
        pos = end + 1;
        continue;
      }
      const op = OPS.find((o) => rest.startsWith(o));
      if (!op) throw new PythonError(err.cantUseHere({ ch }), line);
      if (op === '(') depth++;
      if (op === ')') depth = Math.max(0, depth - 1);
      out.push({ kind: 'op', value: op, line });
      pos += op.length;
    }
    if (depth === 0) out.push({ kind: 'newline', value: '', line });
  });
  if (depth > 0) throw new PythonError(err.unclosedBracket, lines.length);
  const last = lines.length;
  while (indents.length > 1) {
    indents.pop();
    out.push({ kind: 'dedent', value: '', line: last });
  }
  out.push({ kind: 'eof', value: '', line: last });
  return out;
}

// ── AST ─────────────────────────────────────────────────────────────────────

export type Expr =
  | { readonly k: 'num'; readonly v: number; readonly line: number }
  | { readonly k: 'str'; readonly v: string; readonly line: number }
  | { readonly k: 'bool'; readonly v: boolean; readonly line: number }
  | { readonly k: 'name'; readonly v: string; readonly line: number }
  | { readonly k: 'attr'; readonly obj: Expr; readonly name: string; readonly line: number }
  | { readonly k: 'call'; readonly fn: Expr; readonly args: readonly Expr[]; readonly line: number }
  | { readonly k: 'neg'; readonly e: Expr; readonly line: number }
  | { readonly k: 'not'; readonly e: Expr; readonly line: number }
  | { readonly k: 'bin'; readonly op: '+' | '-' | '*' | '/'; readonly l: Expr; readonly r: Expr; readonly line: number }
  | { readonly k: 'cmp'; readonly op: '<' | '>' | '==' | '!=' | '<=' | '>='; readonly l: Expr; readonly r: Expr; readonly line: number }
  | { readonly k: 'logic'; readonly op: 'and' | 'or'; readonly l: Expr; readonly r: Expr; readonly line: number };

export type Stmt =
  | { readonly k: 'expr'; readonly e: Expr; readonly line: number; readonly comment?: string }
  | { readonly k: 'assign'; readonly name: string; readonly op: '=' | '+=' | '-='; readonly value: Expr; readonly line: number; readonly comment?: string }
  | { readonly k: 'if'; readonly branches: readonly { readonly cond: Expr; readonly body: readonly Stmt[] }[]; readonly orelse: readonly Stmt[] | null; readonly line: number; readonly comment?: string }
  | { readonly k: 'while'; readonly cond: Expr; readonly body: readonly Stmt[]; readonly line: number; readonly comment?: string }
  | { readonly k: 'for'; readonly varName: string; readonly count: Expr; readonly body: readonly Stmt[]; readonly line: number; readonly comment?: string }
  | { readonly k: 'def'; readonly name: string; readonly body: readonly Stmt[]; readonly line: number; readonly comment?: string }
  | { readonly k: 'break'; readonly line: number; readonly comment?: string }
  | { readonly k: 'pass'; readonly line: number; readonly comment?: string };

/** Tokens → statements. */
export function parse(source: string): Stmt[] {
  const err = messagesFor(pythonErrorMessages);
  const toks = tokenize(source);
  let i = 0;
  const peek = (o = 0) => toks[Math.min(i + o, toks.length - 1)]!;
  const next = () => toks[i++]!;
  const isOp = (v: string, o = 0) => peek(o).kind === 'op' && peek(o).value === v;
  const isName = (v: string, o = 0) => peek(o).kind === 'name' && peek(o).value === v;
  const expectOp = (v: string, what: string) => {
    if (!isOp(v)) throw new PythonError(err.expectedOp({ op: v, what }), peek().line);
    return next();
  };
  const expectName = (what: string) => {
    const t = peek();
    if (t.kind !== 'name' || KEYWORDS.has(t.value)) throw new PythonError(err.expectedName({ what }), t.line);
    return next();
  };
  const endOfLine = () => {
    if (peek().kind === 'newline') return void next();
    if (peek().kind === 'eof' || peek().kind === 'dedent') return;
    throw new PythonError(err.onePerLine({ value: peek().value }), peek().line);
  };

  // Expressions (precedence climbing, lowest first).
  const expr = (): Expr => or();
  const or = (): Expr => {
    let l = and();
    while (isName('or')) {
      const line = next().line;
      l = { k: 'logic', op: 'or', l, r: and(), line };
    }
    return l;
  };
  const and = (): Expr => {
    let l = not();
    while (isName('and')) {
      const line = next().line;
      l = { k: 'logic', op: 'and', l, r: not(), line };
    }
    return l;
  };
  const not = (): Expr => {
    if (isName('not')) {
      const line = next().line;
      return { k: 'not', e: not(), line };
    }
    return comparison();
  };
  const CMP = ['<', '>', '==', '!=', '<=', '>='] as const;
  const comparison = (): Expr => {
    const l = sum();
    const op = CMP.find((o) => isOp(o));
    if (!op) return l;
    const line = next().line;
    const r = sum();
    if (CMP.some((o) => isOp(o))) throw new PythonError(err.compareTwo, line);
    return { k: 'cmp', op, l, r, line };
  };
  const sum = (): Expr => {
    let l = term();
    while (isOp('+') || isOp('-')) {
      const t = next();
      l = { k: 'bin', op: t.value as '+' | '-', l, r: term(), line: t.line };
    }
    return l;
  };
  const term = (): Expr => {
    let l = unary();
    while (isOp('*') || isOp('/')) {
      const t = next();
      l = { k: 'bin', op: t.value as '*' | '/', l, r: unary(), line: t.line };
    }
    return l;
  };
  const unary = (): Expr => {
    if (isOp('-')) {
      const line = next().line;
      const e = unary();
      return e.k === 'num' ? { k: 'num', v: -e.v, line } : { k: 'neg', e, line };
    }
    if (isOp('+')) {
      next();
      return unary();
    }
    return postfix();
  };
  const postfix = (): Expr => {
    let e = atom();
    for (;;) {
      if (isOp('.')) {
        next();
        e = { k: 'attr', obj: e, name: expectName(err.afterDot).value, line: e.line };
      } else if (isOp('(')) {
        const line = next().line;
        const args: Expr[] = [];
        while (!isOp(')')) {
          // Keyword arguments (cm=30) are accepted; the name is ignored.
          if (peek().kind === 'name' && isOp('=', 1)) i += 2;
          args.push(expr());
          if (!isOp(',')) break;
          next();
        }
        expectOp(')', err.closeBrackets);
        e = { k: 'call', fn: e, args, line };
      } else return e;
    }
  };
  const atom = (): Expr => {
    const t = peek();
    if (t.kind === 'num') {
      next();
      return { k: 'num', v: Number(t.value), line: t.line };
    }
    if (t.kind === 'str') {
      next();
      return { k: 'str', v: t.value, line: t.line };
    }
    if (t.kind === 'name' && (t.value === 'True' || t.value === 'False')) {
      next();
      return { k: 'bool', v: t.value === 'True', line: t.line };
    }
    if (t.kind === 'name' && !KEYWORDS.has(t.value)) {
      next();
      return { k: 'name', v: t.value, line: t.line };
    }
    if (isOp('(')) {
      next();
      const e = expr();
      expectOp(')', err.closeBrackets);
      return e;
    }
    if (t.kind === 'newline' || t.kind === 'eof') throw new PythonError(err.endsTooEarly, t.line);
    throw new PythonError(err.cantUseHere({ ch: t.value }), t.line);
  };

  // Statements.
  const block = (): Stmt[] => {
    expectOp(':', err.endOfLine);
    if (peek().kind !== 'newline') {
      const s = simple(null);
      endOfLine();
      return [s];
    }
    next();
    while (peek().kind === 'comment') next();
    if (peek().kind !== 'indent') throw new PythonError(err.mustBeIndented, peek().line);
    next();
    const body: Stmt[] = [];
    while (peek().kind !== 'dedent' && peek().kind !== 'eof') body.push(...statement());
    if (peek().kind === 'dedent') next();
    return body;
  };

  const simple = (comment: string | null): Stmt => {
    const t = peek();
    const c = comment ? { comment } : {};
    if (isName('break')) return { k: 'break', line: next().line, ...c };
    if (isName('pass')) return { k: 'pass', line: next().line, ...c };
    if (isName('continue')) throw new PythonError(err.noContinue, t.line);
    if (isName('return')) throw new PythonError(err.noReturn, t.line);
    if (t.kind === 'name' && !KEYWORDS.has(t.value) && (isOp('=', 1) || isOp('+=', 1) || isOp('-=', 1) || isOp('*=', 1) || isOp('/=', 1))) {
      next();
      const op = next().value;
      if (op === '*=' || op === '/=') throw new PythonError(err.noMulDivAssign({ op, name: t.value, baseOp: op[0]! }), t.line);
      return { k: 'assign', name: t.value, op: op as '=' | '+=' | '-=', value: expr(), line: t.line, ...c };
    }
    const e = expr();
    if (isOp('=')) throw new PythonError(err.onlyVarLeft, t.line);
    return { k: 'expr', e, line: t.line, ...c };
  };

  const statement = (): Stmt[] => {
    const notes: string[] = [];
    while (peek().kind === 'comment') notes.push(next().value);
    const comment = notes.length ? notes.join('\n') : null;
    const c = comment ? { comment } : {};
    const t = peek();
    if (t.kind === 'eof' || t.kind === 'dedent') return [];
    if (t.kind === 'indent') throw new PythonError(err.unexpectedIndent, t.line);
    if (isName('import') || isName('from')) {
      // `from onerobolab import robot, mission` and `import random` are always there.
      const words: string[] = [];
      while (peek().kind !== 'newline' && peek().kind !== 'eof') words.push(next().value);
      endOfLine();
      const mod = words[1] ?? '';
      if (mod !== 'onerobolab' && mod !== 'random') throw new PythonError(err.moduleUnavailable({ mod }), t.line);
      return [];
    }
    if (isName('if')) {
      next();
      const branches = [{ cond: expr(), body: block() }];
      let orelse: Stmt[] | null = null;
      for (;;) {
        while (peek().kind === 'comment' && toks[i + 1]?.kind === 'name' && (toks[i + 1]!.value === 'elif' || toks[i + 1]!.value === 'else')) next();
        if (isName('elif')) {
          next();
          branches.push({ cond: expr(), body: block() });
        } else if (isName('else')) {
          next();
          orelse = block();
          break;
        } else break;
      }
      return [{ k: 'if', branches, orelse, line: t.line, ...c }];
    }
    if (isName('elif') || isName('else')) throw new PythonError(err.elifNeedsIf({ kw: t.value }), t.line);
    if (isName('while')) {
      next();
      const cond = expr();
      return [{ k: 'while', cond, body: block(), line: t.line, ...c }];
    }
    if (isName('for')) {
      next();
      const v = expectName(err.loopVarHint).value;
      if (!isName('in')) throw new PythonError(err.writeForIn, t.line);
      next();
      if (!isName('range')) throw new PythonError(err.useRange, t.line);
      next();
      expectOp('(', err.afterRange);
      const count = expr();
      if (isOp(',')) throw new PythonError(err.rangeOneNumber, t.line);
      expectOp(')', err.closeRange);
      return [{ k: 'for', varName: v, count, body: block(), line: t.line, ...c }];
    }
    if (isName('def')) {
      next();
      const name = expectName(err.functionNameHint).value;
      expectOp('(', err.afterFunctionName);
      if (!isOp(')')) throw new PythonError(err.noFunctionArgs, t.line);
      next();
      return [{ k: 'def', name, body: block(), line: t.line, ...c }];
    }
    if (t.kind === 'name' && KEYWORDS.has(t.value) && !['break', 'pass', 'not', 'True', 'False', 'continue', 'return'].includes(t.value)) {
      throw new PythonError(err.keywordUnavailable({ kw: t.value }), t.line);
    }
    const s = simple(comment);
    endOfLine();
    return [s];
  };

  const body: Stmt[] = [];
  while (peek().kind !== 'eof') {
    if (peek().kind === 'newline') {
      next();
      continue;
    }
    if (peek().kind === 'dedent') throw new PythonError(err.dedentMismatch, peek().line);
    body.push(...statement());
  }
  return body;
}
