type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: (a) => Math.sin(a),
  cos: (a) => Math.cos(a),
  tan: (a) => Math.tan(a),
  asin: (a) => Math.asin(a),
  acos: (a) => Math.acos(a),
  atan: (a) => Math.atan(a),
  abs: (a) => Math.abs(a),
  sqrt: (a) => (a < 0 ? Number.NaN : Math.sqrt(a)),
  log: (a) => (a <= 0 ? Number.NaN : Math.log10(a)),
  log10: (a) => (a <= 0 ? Number.NaN : Math.log10(a)),
  ln: (a) => (a <= 0 ? Number.NaN : Math.log(a)),
  exp: (a) => Math.exp(a),
  floor: (a) => Math.floor(a),
  ceil: (a) => Math.ceil(a),
  round: (a) => Math.round(a),
  sign: (a) => Math.sign(a),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  pow: (a, b) => Math.pow(a, b),
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
};

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];

    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        if (s[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error('Invalid number literal');
        numStr += s[i];
        i++;
      }
      // Scientific notation e.g. 6.674e-11
      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        const next = s[i + 1];
        if ((next >= '0' && next <= '9') || next === '+' || next === '-') {
          numStr += s[i];
          i++;
          if (s[i] === '+' || s[i] === '-') {
            numStr += s[i];
            i++;
          }
          while (i < s.length && s[i] >= '0' && s[i] <= '9') {
            numStr += s[i];
            i++;
          }
        }
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) throw new Error('Non-finite number');
      tokens.push({ type: 'number', value: val });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let id = '';
      while (
        i < s.length &&
        ((s[i] >= 'a' && s[i] <= 'z') ||
          (s[i] >= 'A' && s[i] <= 'Z') ||
          (s[i] >= '0' && s[i] <= '9') ||
          s[i] === '_')
      ) {
        id += s[i];
        i++;
      }
      tokens.push({ type: 'ident', value: id });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }

    // Handle unicode minus or multiplication cleanly
    if (ch === '−') {
      tokens.push({ type: 'op', value: '-' });
      i++;
      continue;
    }
    if (ch === '×' || ch === '·') {
      tokens.push({ type: 'op', value: '*' });
      i++;
      continue;
    }
    if (ch === '÷') {
      tokens.push({ type: 'op', value: '/' });
      i++;
      continue;
    }

    throw new Error(`Unsupported character in expression: ${ch}`);
  }

  return tokens;
}

export type MathAst =
  | { kind: 'number'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '-' | '+'; arg: MathAst }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: MathAst; right: MathAst }
  | { kind: 'call'; fn: string; args: MathAst[] };

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  parse(): MathAst {
    const node = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing token in math expression');
    }
    return node;
  }

  private parseAddSub(): MathAst {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { kind: 'binary', op: t.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): MathAst {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        left = { kind: 'binary', op: t.value, left, right };
      } else if (
        t &&
        ((t.type === 'paren' && t.value === '(') || t.type === 'ident')
      ) {
        // Implicit multiplication e.g. 2x, 2(x+1), (x)(y)
        const right = this.parseUnary();
        left = { kind: 'binary', op: '*', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): MathAst {
    const t = this.peek();
    if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      this.consume();
      const arg = this.parseUnary();
      return { kind: 'unary', op: t.value, arg };
    }
    return this.parsePower();
  }

  private parsePower(): MathAst {
    const base = this.parsePrimary();
    const t = this.peek();
    if (t && t.type === 'op' && t.value === '^') {
      this.consume();
      const exponent = this.parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): MathAst {
    const t = this.peek();
    if (!t) {
      throw new Error('Unexpected end of expression');
    }

    if (t.type === 'number') {
      this.consume();
      return { kind: 'number', value: t.value };
    }

    if (t.type === 'ident') {
      this.consume();
      const next = this.peek();
      if (next && next.type === 'paren' && next.value === '(') {
        this.consume(); // '('
        const args: MathAst[] = [];
        const maybeClose = this.peek();
        if (!maybeClose || maybeClose.type !== 'paren' || maybeClose.value !== ')') {
          while (true) {
            args.push(this.parseAddSub());
            const sep = this.peek();
            if (sep && sep.type === 'comma') {
              this.consume();
              continue;
            }
            break;
          }
        }
        const close = this.peek();
        if (!close || close.type !== 'paren' || close.value !== ')') {
          throw new Error('Expected closing parenthesis');
        }
        this.consume();
        if (!FUNCTIONS[t.value]) {
          throw new Error(`Unknown function: ${t.value}`);
        }
        return { kind: 'call', fn: t.value, args };
      }

      if (t.value in CONSTANTS) {
        return { kind: 'number', value: CONSTANTS[t.value] };
      }
      return { kind: 'var', name: t.value };
    }

    if (t.type === 'paren' && t.value === '(') {
      this.consume();
      const inner = this.parseAddSub();
      const close = this.peek();
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume();
      return inner;
    }

    throw new Error('Invalid syntax in math expression');
  }
}

export function compileMathExpression(expr: string): MathAst {
  if (!expr || expr.length > 220) {
    throw new Error('Expression empty or too long');
  }
  const tokens = tokenize(expr);
  return new Parser(tokens).parse();
}

export function evalMathAst(ast: MathAst, vars: Record<string, number>): number {
  switch (ast.kind) {
    case 'number':
      return ast.value;
    case 'var': {
      if (ast.name in vars) {
        const val = vars[ast.name];
        return Number.isFinite(val) ? val : Number.NaN;
      }
      return Number.NaN;
    }
    case 'unary': {
      const v = evalMathAst(ast.arg, vars);
      return ast.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evalMathAst(ast.left, vars);
      const r = evalMathAst(ast.right, vars);
      if (!Number.isFinite(l) || !Number.isFinite(r)) return Number.NaN;
      switch (ast.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? Number.NaN : l / r;
        case '^':
          return Math.pow(l, r);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[ast.fn];
      if (!fn) return Number.NaN;
      const argVals = ast.args.map((a) => evalMathAst(a, vars));
      if (argVals.some((v) => !Number.isFinite(v))) return Number.NaN;
      const out = fn(...argVals);
      return Number.isFinite(out) ? out : Number.NaN;
    }
  }
}

export function evaluateMathExpression(
  expr: string,
  vars: Record<string, number> = {}
): number | null {
  try {
    const ast = compileMathExpression(expr);
    const val = evalMathAst(ast, vars);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function isValidMathExpression(expr: string, allowedVars: string[] = []): boolean {
  try {
    const ast = compileMathExpression(expr);
    const checkVars = (node: MathAst): boolean => {
      switch (node.kind) {
        case 'number':
          return true;
        case 'var':
          return allowedVars.length === 0 || allowedVars.includes(node.name);
        case 'unary':
          return checkVars(node.arg);
        case 'binary':
          return checkVars(node.left) && checkVars(node.right);
        case 'call':
          return node.args.every(checkVars);
      }
    };
    return checkVars(ast);
  } catch {
    return false;
  }
}

export function numericalDerivative(
  ast: MathAst,
  x: number,
  vars: Record<string, number>
): number | null {
  const h = 1e-4;
  const fPlus = evalMathAst(ast, { ...vars, x: x + h });
  const fMinus = evalMathAst(ast, { ...vars, x: x - h });
  if (!Number.isFinite(fPlus) || !Number.isFinite(fMinus)) return null;
  const deriv = (fPlus - fMinus) / (2 * h);
  return Number.isFinite(deriv) ? deriv : null;
}

export function formatNumber(n: number, precision = 3): string {
  if (!Number.isFinite(n)) return ',';
  if (Math.abs(n) === 0) return '0';
  if (Math.abs(n) >= 100000 || (Math.abs(n) > 0 && Math.abs(n) < 0.001)) {
    return n.toExponential(2);
  }
  const fixed = Number(n.toPrecision(precision + 1));
  return String(fixed);
}
