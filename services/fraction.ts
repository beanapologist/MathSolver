
export class Fraction {
  numerator: bigint;
  denominator: bigint;

  constructor(numerator: number | bigint, denominator: number | bigint = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);

    if (d === 0n) throw new Error("Denominator cannot be zero");

    const common = this.gcd(n < 0n ? -n : n, d < 0n ? -d : d);
    this.numerator = (d < 0n ? -n : n) / common;
    this.denominator = (d < 0n ? -d : d) / common;
  }

  private gcd(a: bigint, b: bigint): bigint {
    while (b > 0n) {
      a %= b;
      [a, b] = [b, a];
    }
    return a;
  }

  add(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  sub(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  div(other: Fraction): Fraction {
    return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  toNumber(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  toString(): string {
    return this.denominator === 1n ? this.numerator.toString() : `${this.numerator}/${this.denominator}`;
  }
}
