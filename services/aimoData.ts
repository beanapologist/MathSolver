
import { ReferenceProblem } from '../types';

export const AIMO3_BENCHMARK: ReferenceProblem[] = [
  {
    id: 1,
    title: "SWEETS (Alice & Bob)",
    problem: "Alice and Bob are each holding some integer number of sweets. Alice says to Bob: 'If we each added the number of sweets we're holding to our (positive integer) age, my answer would be double yours. If we took the product, then my answer would be four times yours.' Bob replies: 'Why don't you give me five of your sweets because then both our sum and product would be equal.' What is the product of Alice and Bob's ages?",
    expectedAnswer: 50
  },
  {
    id: 2,
    title: "RECTIL (Unique Perimeters)",
    problem: "A 500 x 500 square is divided into k rectangles, each having integer side lengths. Given that no two of these rectangles have the same perimeter, the largest possible value of k is K. What is the remainder when K is divided by 10^5?",
    expectedAnswer: 520
  },
  {
    id: 3,
    title: "MINPER (Triangle Geometry)",
    problem: "Let ABC be an acute-angled triangle with integer side lengths and AB < AC. Points D and E lie on segments BC and AC, respectively, such that AD = AE = AB. Line DE intersects AB at X. Circles BXD and CED intersect for the second time at Y != D. Suppose that Y lies on line AD. There is a unique such triangle with minimal perimeter. This triangle has side lengths a = BC, b = CA, and c = AB. Find the remainder when abc is divided by 10^5.",
    expectedAnswer: 336
  },
  {
    id: 4,
    title: "FUNVAL (Functional Equation)",
    problem: "Let f: Z>=1 -> Z>=1 be a function such that for all positive integers m and n, f(m) + f(n) = f(m + n + mn). Across all functions f such that f(n) <= 1000 for all n <= 1000, how many different values can f(2024) take?",
    expectedAnswer: 580
  },
  {
    id: 5,
    title: "Tournament Ranking",
    problem: "A tournament is held with 2^20 runners each of which has a different running speed. In each race, two runners compete against each other with the faster runner always winning the race. The competition consists of 20 rounds with each runner starting with a score of 0. In each round, the runners are paired in such a way that in each pair, both runners have the same score at the beginning of the round. The winner of each race in the ith round receives 2^(20-i) points and the loser gets no points. At the end of the tournament, we rank the competitors according to their scores. Let N denote the number of possible orderings of the competitors at the end of the tournament. Let k be the largest positive integer such that 10^k divides N. What is the remainder when k is divided by 10^5?",
    expectedAnswer: 21818
  },
  {
    id: 6,
    title: "Summation Identity",
    problem: "Define a function f: Z>=1 -> Z>=1 by f(n) = sum_{i=1}^n sum_{j=1}^n j^1024 floor(1/j + (n-i)/n). Let M = 2*3*5*7*11*13 and let N = f(M^15) - f(M^15 - 1). Let k be the largest non-negative integer such that 2^k divides N. What is the remainder when 2^k is divided by 5^7?",
    expectedAnswer: 32951
  },
  {
    id: 7,
    title: "n-tastic Triangles",
    problem: "Let ABC be a triangle with AB != AC, circumcircle Omega, and incircle omega. Let the contact points of omega with BC, CA, and AB be D, E, and F, respectively. Let the circumcircle of AFE meet Omega at K and let the reflection of K in EF be K'. Let N denote the foot of the perpendicular from D to EF. The circle tangent to line BN and passing through B and K intersects BC again at T != B. Let sequence (Fn) be defined by F0=0, F1=1 and Fn = Fn-1 + Fn-2. Call ABC n-tastic if BD = Fn, CD = Fn+1, and KNK'B is cyclic. Across all n-tastic triangles, let an denote the maximum possible value of (CT*NB)/(BT*NE). Let alpha denote the smallest real number such that for all sufficiently large n, a_2n < alpha. Given that alpha = p + sqrt(q) for rationals p and q, what is the remainder when q^p is divided by 99991?",
    expectedAnswer: 57447
  },
  {
    id: 8,
    title: "Blackboard Moves",
    problem: "On a blackboard, Ken starts off by writing a positive integer n and then applies the following move until he first reaches 1. Given that the number on the board is m, he chooses a base b, where 2 <= b <= m, and replaces m with the sum of its base-b digits. Across all choices of 1 <= n <= 10^(10^5), the largest possible number of moves Ken could make is M. What is the remainder when M is divided by 10^5?",
    expectedAnswer: 32193
  },
  {
    id: 9,
    title: "Shifty Functions",
    problem: "Let F be the set of functions alpha: Z -> Z for which there are only finitely many n in Z such that alpha(n) != 0. Define product alpha * beta = sum alpha(n)beta(n). A function alpha is called shifty if alpha(m) = 0 for m < 0 and m > 8, and there exists beta such that Sn(alpha)*beta = 1 if n is in {k, l} else 0 for some k != l. How many shifty functions are there in F?",
    expectedAnswer: 160
  },
  {
    id: 10,
    title: "n-Norwegian Integers",
    problem: "Let n >= 6 be a positive integer. A positive integer is n-Norwegian if it has three distinct positive divisors whose sum is equal to n. Let f(n) denote the smallest n-Norwegian positive integer. Let M = 3^(2025!) and g(c) = floor(2025! f(M+c)/M) / 2025!. If g(0) + g(4M) + g(1848374) + g(10162574) + g(265710644) + g(44636594) = p/q for coprime p, q, find p+q mod 99991.",
    expectedAnswer: 8687
  }
];
